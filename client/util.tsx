import {Property, Show, createElement} from "cstk";

export function LoadingIndicator({loading}: {
    loading: Property<any>,
}) {
    return <Show when={loading}>
        <div class='stack-row spacing'>
            <div class='spinner'></div>
            <div>Please wait...</div>
        </div>
    </Show>;
}
