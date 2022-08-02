import {bind, createElement, Deref, For, Fragment, Property, Show, zipWith} from "cstk";
import {differenceInYears, format, parseISO} from "date-fns";
import { User } from "./dto";
import { AuthService } from "./services/auth-service";
import {GameService} from "./services/game-service";
import {dataSource, DerefData, LoadingIndicator} from "./util";

export function Status({gameService, user, authService}: {
    user: Property<User>
    gameService: GameService,
    authService: AuthService,
}, context: JSX.Context) {
    const bunker = dataSource(() => gameService.getBunker());
    return <>
    <div class='stack-row spacing justify-space-between align-center'>
        <div>Welcome back, {user.props.username}.</div>
        <div class='stack-row spacing'>
            <button onClick={() => gameService.world.value = undefined}>Switch</button>
            <button onClick={() => authService.invalidate()}>Log Out</button>
        </div>
    </div>
    <div class='margin-top stack-column spacing'>
        <DerefData data={bunker}>{bunker =>
            <>
                <div class='stack-row spacing justify-space-between'>
                    <div>Reactor</div>
                    <div>{bunker.props.data.props.reactor.props.condition}%</div>
                </div>
                <div class='stack-row spacing justify-space-between'>
                    <div>Water treatment</div>
                    <div>{bunker.props.data.props.waterTreatment.props.condition}%</div>
                </div>
                <div class='stack-row spacing justify-space-between'>
                    <div>Air recycling</div>
                    <div>{bunker.props.data.props.airRecycling.props.condition}%</div>
                </div>
                <div class='stack-row spacing justify-space-between'>
                    <div>Horticulture</div>
                    <div>{bunker.props.data.props.horticulture.props.condition}%</div>
                </div>
                <div class='stack-row spacing justify-space-between'>
                    <div>Infirmary</div>
                    <div>{bunker.props.data.props.infirmary.props.level}</div>
                </div>
                <div class='stack-row spacing justify-space-between'>
                    <div>Workshop</div>
                    <div>{bunker.props.data.props.workshop.props.level}</div>
                </div>
            </>
            }</DerefData>
    </div>
</>;
}
