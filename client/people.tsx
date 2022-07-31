import {bind, createElement, Deref, For, Fragment, Show, zipWith} from "cstk";
import {differenceInYears, format, parseISO} from "date-fns";
import { openDialog } from "./dialog";
import { Inhabitant } from "./dto";
import { ErrorIndicator } from "./error";
import {GameService} from "./services/game-service";
import {dataSource, DerefData, LoadingIndicator} from "./util";

export function People({gameService}: {
    gameService: GameService,
}, context: JSX.Context) {
    const people = dataSource(() => gameService.getInhabitants());

    function openDetails(person: Inhabitant) {
        openDialog(Details, {person});
    }

    return <>
        <DerefData data={people}>{people =>
            <>
                <div class='stack-column' role='grid'>
                    <For each={people}>{person =>
                        <button class='stack-row spacing' role='row' onClick={() => openDetails(person.value)}>
                            <div>{person.props.name}</div>
                            <div>(Age: {zipWith([gameService.worldTime, person.props.dateOfBirth], (wt, dob) => {
                                return '' + differenceInYears(wt, parseISO(dob));
                            })})</div>
                            <Show when={person.props.expeditionId}>
                                <div style='margin-left: auto;'>(on mission)</div>
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

function Details({person}: {
    person: Inhabitant,
}) {
    return <div class='padding spacing stack-column'>
        <div class='stack-row spacing justify-space-between'>
            <div style='font-weight: bold'>Name:</div>
            <div>{person.name}</div>
        </div>
        <div class='stack-row spacing justify-space-between'>
            <div style='font-weight: bold'>Date of birth:</div>
            <div>{format(parseISO(person.dateOfBirth), 'MM/dd/yy')}</div>
        </div>
        <For each={bind(person.data.skills)}>{skill =>
            <div class='stack-row spacing justify-space-between'>
                <div style='font-weight: bold'>{skill.props.skillType}</div>
                <div>Level {skill.props.level}</div>
            </div>
        }</For>
    </div>;
}
