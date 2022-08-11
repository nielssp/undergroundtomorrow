use std::{collections::{HashMap, HashSet}, time::Duration};

use actix::*;
use actix_web_actors::ws;
use rand::{rngs::ThreadRng, Rng};
use time::Instant;
use tracing::info;


#[derive(actix::Message, Clone)]
#[rtype(result = "()")]
pub struct Message {
    message: String,
}

#[derive(actix::Message)]
#[rtype(usize)]
pub struct Connect {
    pub addr: Recipient<Message>,
    pub world_id: i32,
    pub bunker_id: i32,
}

#[derive(actix::Message)]
#[rtype(result = "()")]
pub struct Disconnect {
    pub id: usize,
    pub world_id: i32,
    pub bunker_id: i32,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct BunkerMessage {
    pub bunker_id: i32,
    pub message: String,
}

#[derive(Message)]
#[rtype(result = "()")]
pub struct WorldMessage {
    pub world_id: i32,
    pub message: String,
}

pub struct Broadcaster {
    sessions: HashMap<usize, Recipient<Message>>,
    worlds: HashMap<i32, HashSet<usize>>,
    bunkers: HashMap<i32, HashSet<usize>>,
    rng: ThreadRng,
}

impl Broadcaster {
    pub fn new() -> Broadcaster {
        Broadcaster {
            sessions: HashMap::new(),
            worlds: HashMap::new(),
            bunkers: HashMap::new(),
            rng: rand::thread_rng(),
        }
    }

    pub fn send_to_world(&self, world_id: i32, message: &Message) {
        if let Some(sessions) = self.worlds.get(&world_id) {
            for session_id in sessions {
                if let Some(recipient) = self.sessions.get(session_id) {
                    recipient.do_send(message.clone());
                }
            }
        }
    }

    pub fn send_to_bunker(&self, bunker_id: i32, message: &Message) {
        if let Some(sessions) = self.bunkers.get(&bunker_id) {
            for session_id in sessions {
                if let Some(recipient) = self.sessions.get(session_id) {
                    recipient.do_send(message.clone());
                }
            }
        }
    }
}

impl Actor for Broadcaster {
    type Context = Context<Self>;
}

impl Handler<Connect> for Broadcaster {
    type Result = usize;

    fn handle(&mut self, msg: Connect, _: &mut Context<Self>) -> Self::Result {
        info!("Broadcast receiver connected for bunker {} world {}", msg.bunker_id, msg.world_id);
        let id: usize = self.rng.gen();
        self.sessions.insert(id, msg.addr);
        if let Some(world) = self.worlds.get_mut(&msg.world_id) {
            world.insert(id);
        } else {
            self.worlds.insert(msg.world_id, HashSet::from([id]));
        }
        if let Some(bunker) = self.bunkers.get_mut(&msg.bunker_id) {
            bunker.insert(id);
        } else {
            self.bunkers.insert(msg.bunker_id, HashSet::from([id]));
        }
        id
    }
}

impl Handler<Disconnect> for Broadcaster {
    type Result = ();

    fn handle(&mut self, msg: Disconnect, _: &mut Context<Self>) {
        self.sessions.remove(&msg.id);
        if let Some(world) = self.worlds.get_mut(&msg.world_id) {
            world.remove(&msg.id);
        }
        if let Some(bunker) = self.bunkers.get_mut(&msg.bunker_id) {
            bunker.remove(&msg.id);
        }
    }
}

impl Handler<BunkerMessage> for Broadcaster {
    type Result = ();

    fn handle(&mut self, msg: BunkerMessage, _: &mut Context<Self>) {
        self.send_to_bunker(msg.bunker_id, &Message { message: msg.message });
    }
}

impl Handler<WorldMessage> for Broadcaster {
    type Result = ();

    fn handle(&mut self, msg: WorldMessage, _: &mut Context<Self>) {
        self.send_to_world(msg.world_id, &Message { message: msg.message });
    }
}

pub struct BroadcastReceiver {
    pub id: usize,
    pub world_id: i32,
    pub bunker_id: i32,
    pub heartbeat: Instant,
    pub broadcaster: Addr<Broadcaster>,
}

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(10);

impl BroadcastReceiver {
    pub fn new(broadcaster: Addr<Broadcaster>, world_id: i32, bunker_id: i32) -> BroadcastReceiver {
        BroadcastReceiver {
            id: 0,
            world_id,
            bunker_id,
            heartbeat: Instant::now(),
            broadcaster,
        }
    }

    fn hb(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            if Instant::now() - act.heartbeat > CLIENT_TIMEOUT {
                act.broadcaster.do_send(Disconnect {
                    id: act.id,
                    world_id: act.world_id,
                    bunker_id: act.bunker_id,
                });
                ctx.stop();
                return;
            }

            ctx.ping(b"");
        });
    }
}

impl Actor for BroadcastReceiver {
    type Context = ws::WebsocketContext<Self>;
    fn started(&mut self, ctx: &mut Self::Context) {
        self.hb(ctx);
        let addr = ctx.address();
        self.broadcaster
            .send(Connect {
                addr: addr.recipient(),
                world_id: self.world_id,
                bunker_id: self.bunker_id,
            })
            .into_actor(self)
            .then(|res, act, ctx| {
                match res {
                    Ok(res) => act.id = res,
                    // something is wrong with chat server
                    _ => ctx.stop(),
                }
                fut::ready(())
            })
            .wait(ctx);
    }

    fn stopping(&mut self, _: &mut Self::Context) -> Running {
        self.broadcaster.do_send(Disconnect {
            id: self.id,
            world_id: self.world_id,
            bunker_id: self.bunker_id,
        });
        Running::Stop
    }
}

impl Handler<Message> for BroadcastReceiver {
    type Result = ();

    fn handle(&mut self, msg: Message, ctx: &mut Self::Context) {
        ctx.text(msg.message);
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for BroadcastReceiver {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        let msg = match msg {
            Err(_) => {
                ctx.stop();
                return;
            }
            Ok(msg) => msg,
        };
        match msg {
            ws::Message::Ping(msg) => {
                self.heartbeat = Instant::now();
                ctx.pong(&msg);
            }
            ws::Message::Pong(_) => {
                self.heartbeat = Instant::now();
            }
            ws::Message::Text(_) => {
                info!("Ignored text message from WebSocket client");
            }
            ws::Message::Binary(_) =>{
                info!("Ignored binary message from WebSocket client");
            },
            ws::Message::Close(reason) => {
                ctx.close(reason);
                ctx.stop();
            }
            ws::Message::Continuation(_) => {
                ctx.stop();
            }
            ws::Message::Nop => (),
        }
    }
}
