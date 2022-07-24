import {bind, createElement, Deref, For, Fragment, Show, zipWith} from "cstk";
import {differenceInYears, format, parseISO} from "date-fns";
import {GameService} from "./services/game-service";
import {LoadingIndicator} from "./util";

export function People({gameService}: {
    gameService: GameService,
}, context: JSX.Context) {
    const error = bind(false);
    const promise = bind(gameService.getInhabitants());
    const people = promise.await(() => error.value = true);
    return <>
        <LoadingIndicator loading={people.not.and(error.not)}/>
        <Show when={error}>
            <div>ERROR</div>
        </Show>
        <Deref ref={people}>{people =>
            <>
                <div class='stack-column spacing'>
                    <For each={people}>{person =>
                        <div class='stack-row spacing'>
                            <div>{person.props.name}</div>
                            <div>(Age: {zipWith([gameService.worldTime, person.props.dateOfBirth], (wt, dob) => {
                                return '' + differenceInYears(wt, parseISO(dob));
                            })})</div>
                        </div>
                        }</For>
                </div>
                <Show when={people.map(p => !p.length)}>
                    <div>No people</div>
                </Show>
            </>
            }</Deref>
    </>;
}
