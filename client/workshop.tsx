import {createElement, For, Property, Show, Fragment, ref, bind, Deref, zipWith} from "cstk";
import { openConfirm, openDialog } from "./dialog";
import { ItemType, RecipeItemType, WorkshopProject, WorkshopStatus } from "./dto";
import { handleError } from "./error";
import {GameService} from "./services/game-service";
import { dataSource, DerefData, getItemName, getItemTypeNameAndQuantity, QuantityButtons } from "./util";

export function Workshop({gameService, status, onReload}: {
    gameService: GameService,
    status: Property<WorkshopStatus>,
    onReload: () => void,
}) {

    function manage() {
        openDialog(ManageProjects, {gameService, status, onReload});
    }

    return <div class='stack-column'>
        <div class='stack-row spacing justify-space-between'>
            <strong>Workshop</strong>
        </div>
        <div class='stack-row spacing align-center'>
            <div>Projects: {status.map(s => s.projects.length)}</div>
            <button style='margin-left: auto;' onClick={manage}>Manage</button>
        </div>
    </div>;
}

export function ManageProjects({gameService, status, onReload}: {
    gameService: GameService,
    status: Property<WorkshopStatus>,
    onReload: () => void,
}) {

    async function add() {
        if (await openDialog(AddProject, {gameService})) {
            onReload();
        }
    }

    async function prioritize(project: WorkshopProject, index: number) {
        try {
            await gameService.prioritizeProject(index);
            onReload();
        } catch (error) {
            handleError(error);
        }
    }

    async function remove(project: WorkshopProject, index: number) {
        if (await openConfirm(`Cancel ${await gameService.getItemTypeName(project.itemType, project.quantity)}?`)) {
            try {
                await gameService.removeProject(index);
                onReload();
            } catch (error) {
                handleError(error);
            }
        }
    }

    return <div class='stack-column spacing padding'>
        <For each={status.props.projects}>{(project, index) => 
            <div class='stack-column'>
                <div class='stack-row spacing justify-space-between'>
                    <strong>
                        {project.map(async p => {
                            const itemType = await gameService.getItemType(p.itemType);
                            if (itemType) {
                                return getItemTypeNameAndQuantity(itemType, p.quantity);
                            }
                            return `${p.itemType} (${p.quantity})`;
                        }).await().orElse('ERROR')}
                    </strong>
                    <div>{project.map(c => Math.floor(c.progress / c.max * 100))}%</div>
                </div>
                <div class='stack-row spacing justify-space-between align-center'>
                    <div>
                        <Show when={project.props.produced}><div>{project.props.produced} produced</div></Show>
                    </div>
                    <div class='stack-row spacing'>
                        <Show when={index}>
                            <button onClick={() => prioritize(project.value, index.value)}>Prioritize</button>
                        </Show>
                        <button onClick={() => remove(project.value, index.value)}>Cancel</button>
                    </div>
                </div>
            </div>
        }</For>
        <Show when={status.map(s => !s.projects.length)}>
            <div>No active projects</div>
        </Show>
        <div class='stack-row spacing justify-end'>
            <button onClick={add}>Add</button>
        </div>
    </div>;
}

interface Ingredient {
    name: string;
    quantity: number;
    max: number;
}

function AddProject({gameService, close}: {
    gameService: GameService,
    close: (save: boolean) => void,
}) {
    const recipes = dataSource(() => gameService.recipes.then(recipes => recipes.sort((a, b) => a.recipe.minLevel - b.recipe.minLevel)));
    const selection = ref<RecipeItemType>();
    const quantity = bind(0);
    const max = bind(0);
    const ingredients = bind<Ingredient[]>([]);

    async function select(recipe: RecipeItemType) {
        const items = await gameService.getItems();
        let maxValue = Number.MAX_VALUE;
        ingredients.value = await Promise.all(Object.entries(recipe.recipe.ingredients).map(async ([ingredient, quantity]) => {
            const item = items.find(item => item.itemType.id === ingredient);
            let name: string;
            let max = 0;
            if (item) {
                maxValue = Math.min(maxValue, Math.floor(item.quantity / quantity));
                name = item.itemType.namePlural;
                max = item.quantity;
            } else {
                maxValue = 0;
                const itemType = await gameService.getItemType(ingredient);
                if (itemType) {
                    name = itemType.namePlural;
                } else {
                    name = ingredient;
                }
            }
            return {
                name,
                quantity,
                max,
            };
        }));
        max.value = maxValue;
        quantity.value = Math.min(max.value, 1);
        selection.value = recipe;
    }

    async function craft() {
        if (!selection.value) {
            return;
        }
        try {
            await gameService.addProject(selection.value.id, quantity.value);
            close(true);
        } catch (error) {
            handleError(error);
        }
    }

    return <div class='padding spacing stack-column'>
        <Show when={selection.not}>
            <DerefData data={recipes}>{recipes =>
                <>
                    <div role='grid' class='stack-column'>
                        <For each={recipes}>{recipe =>
                            <button role='row' onClick={() => select(recipe.value)}>
                                <div role='gridcell' class='stack-column'>
                                    <div>
                                        <strong>{recipe.props.name}</strong> (Level {recipe.props.recipe.props.minLevel}) {recipe.props.recipe.props.time} hours</div>
                                    <For each={recipe.map(r => Object.entries(r.recipe.ingredients))}>{ingredient =>
                                        <div>{ingredient.map(async ([ingredient, quantity]) => {
                                            const itemType = await gameService.getItemType(ingredient);
                                            if (!itemType) {
                                                return `${ingredient} (${quantity})`;
                                            }
                                            return getItemTypeNameAndQuantity(itemType, quantity);
                                        }).await().orElse('')}</div>
                                    }</For>
                            </div>
                        </button>
                        }</For>
                </div>
                <Show when={recipes.map(p => !p.length)}>
                    <div>No recipes available</div>
                </Show>
            </>
            }</DerefData>
        </Show>
        <Deref ref={selection}>{recipe =>
            <>
                <strong>{recipe.props.name}</strong>
                <div class='stack-row spacing justify-space-between'>
                    <div>Level {recipe.props.recipe.props.minLevel}</div>
                    <div>{recipe.props.recipe.props.time} hours</div>
                </div>
                <strong>Ingredients</strong>
                <For each={ingredients}>{ingredient => 
                    <div class='stack-row spacing justify-space-between'>
                        <div>{ingredient.props.name}</div>
                        <div>{zipWith([ingredient.props.quantity, quantity], (a, b) => a * b)} / {ingredient.props.max}</div>
                    </div>
                }</For>
                <div class='stack-row spacing justify-space-between'>
                    <strong>Quantity:</strong>
                    <div>{quantity} / {max}</div>
                </div>
                <QuantityButtons value={quantity} max={max}/>
                <div class='stack-row spacing justify-end'>
                    <button onClick={() => selection.value = undefined}>Back</button>
                    <button onClick={craft} disabled={quantity.not}>Craft</button>
                </div>
            </>
        }</Deref>
    </div>;
}
