import { bind, createElement, Deref, mount, Show, Fragment, ref } from 'cstk';
import { Api } from './api';
import { environment } from './config/environment';
import { Icon } from './icon';
import { Login } from './login';
import './main.scss';
import { Register } from './register';
import { AuthService } from './services/auth-service';

function Root({authService}: {
    authService: AuthService,
}, context: JSX.Context) {
    const loading = bind(true);
    const register = bind(false);
    const amber = bind(localStorage.getItem('utTheme') === 'amber');

    async function authenticate() {
        loading.value = true;
        try {
            if (await authService.getUser()) {
            }
        } catch (error) {
        } finally {
            loading.value = false;
        }
    }

    authenticate();

    context.onDestroy(amber.getAndObserve(amber => {
        localStorage.setItem('utTheme', amber ? 'amber' : 'green');
        if (amber) {
            document.documentElement.classList.add('amber')
        } else {
            document.documentElement.classList.remove('amber')
        }
    }));

    return <div class='bezel'>
        <div class='display'>
            <Show when={loading}>
                <div>Please wait...</div>
            </Show>
            <Show when={loading.not}>
                <Show when={authService.user.not}>
                    <div>
                        <Icon name='logo'/>
                    </div>
                    <div style='font-weight: bold;'>Underground Tomorrow</div>
                    <div>Bunker Administration Operating System</div>
                    <div>Version 2.0</div>
                    <br/>
                    <Show when={register.not}>
                        <Login authService={authService}/>
                        <br/>
                        <button onClick={() => register.value = true}>Register</button>
                        <br/>
                        <button>Guest</button>
                    </Show>
                    <Show when={register}>
                        <Register authService={authService} onClose={() => register.value = false}/>
                    </Show>
                </Show>
                <Deref ref={authService.user}>{user =>
                    <>
                        <menu role='tablist'>
                            <li><button aria-selected='true'>Status</button></li>
                            <li><button>People</button></li>
                            <li><button>Items</button></li>
                            <li><button>Map</button></li>
                            <li><button>Radio</button></li>
                            <li><button class='attention'><Icon name='message'/></button></li>
                        </menu>
                        <div>Welcome back, {user.props.username}.</div>
                        <div>
                            <button onClick={() => authService.invalidate()}>Log Out</button>
                        </div>
                        <Map/>
                    </>
                }</Deref>
            </Show>
            <div class='status-bar' style='margin-top: auto;'>
                <div class='status'>01/01/2070</div>
                <div class='status'>08:56 AM</div>
                <div class='status' style='flex-grow: 1;'>Bunker 101</div>
                <button onClick={() => amber.value = !amber.value}>Mode</button>
            </div>
        </div>
    </div>;
}

function loadTexture(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
}

function Map({}, context: JSX.Context) {
    const canvasRef = ref<HTMLCanvasElement>();
    context.onInit(async () => {
        if (!canvasRef.value) {
            return;
        }
        const canvas = canvasRef.value;
        const ctx = canvas.getContext('2d')!;
        const map = await loadTexture(require('./assets/map2.png'));
        ctx.drawImage(map, 0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = '#ff9900';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    });
    return <canvas style='flex-grow: 1; width: 100%;' ref={canvasRef}/>;
}

const api = new Api(environment.apiUrl);
const authService = new AuthService(api);

mount(document.body, <Root authService={authService}/>)
