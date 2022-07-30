import {bind, createElement, Deref, For, Fragment, Show, zipWith} from "cstk";
import {differenceInYears, format, parseISO} from "date-fns";
import { ErrorIndicator } from "./error";
import {GameService} from "./services/game-service";
import {dataSource, DerefData, LoadingIndicator} from "./util";

export function People({gameService}: {
    gameService: GameService,
}, context: JSX.Context) {
    const people = dataSource(() => gameService.getInhabitants());
    return <>
        <DerefData data={people}>{people =>
            <>
                <div class='stack-column' role='grid'>
                    <For each={people}>{person =>
                        <button class='stack-row spacing' role='row'>
                            <div>{person.props.name}</div>
                            <div>(Age: {zipWith([gameService.worldTime, person.props.dateOfBirth], (wt, dob) => {
                                return '' + differenceInYears(wt, parseISO(dob));
                            })})</div>
                            <Show when={person.props.expeditionId}>
                                <div>(away)</div>
                            </Show>
                        </button>
                        }</For>
                </div>
                <Show when={people.map(p => !p.length)}>
                    <div>No people</div>
                </Show>
            </>
            }</DerefData>
    </>;
}
