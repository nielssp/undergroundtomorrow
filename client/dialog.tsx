import { apply, bind, Component, createElement, Dynamic, Emitter, Field, Fragment, Input, mount, Property, ref, TextControl } from "cstk";
import { Icon } from "./icon";

export const dialogContainer = bind<HTMLElement>(document.body);

function DialogContent<T extends {}>({container, window, dialog}: {
    container: HTMLElement,
    window: HTMLElement,
    dialog: Dialog<T>,
}): JSX.Element {
    return context => {
        const keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && dialog.canClose.value) {
                e.stopPropagation();
                dialog.close();
            }
            if (e.key === 'Tab') {
                const tabbable = window.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                const first = tabbable.length ? tabbable[0] as HTMLElement : null;
                const last = tabbable.length ? tabbable[tabbable.length - 1] as HTMLElement : null;
                if (e.shiftKey) {
                    if (document.activeElement === first && last) {
                        last.focus();
                        e.preventDefault();
                    }
                } else if (document.activeElement === last && first) {
                    first.focus();
                    e.preventDefault();
                }
            }
        };
        const backdropClickHandler = (e: MouseEvent) => {
            if (!dialog.modal.value && e.target === container) {
                dialog.close();
            }
        };
        context.onInit(() => {
            container.addEventListener('click', backdropClickHandler);
            window.addEventListener('keydown', keyHandler);
            window.focus();
        });
        context.onDestroy(() => {
            container.removeEventListener('click', backdropClickHandler);
            window.removeEventListener('keydown', keyHandler);
        });
        return apply(dialog.body({dialog, ...dialog.props}, context), context);
    };
}

export interface DialogRef {
    readonly isOpen: Property<boolean>;
    readonly onClose: Emitter<void>;
    readonly canClose: Property<boolean>;
    readonly modal: Property<boolean>;
    focus(): void;
    open(): void;
    close(): void;
}

export type DialogBody<T extends {}> = Component<T & {dialog: DialogRef}>;

export class Dialog<T extends {}> implements DialogRef {
    private backdrop: HTMLElement = document.createElement('div');
    private container: HTMLElement = document.createElement('div');
    private window: HTMLElement = document.createElement('div');
    private previousFocus?: HTMLElement;
    private unmount?: () => void;
    readonly isOpen = bind(false);
    readonly onClose = new Emitter<void>();
    readonly canClose = bind(true);
    readonly modal = bind(false);

    constructor(
        public body: DialogBody<T>,
        public props: T,
    ) {
        this.backdrop.className = 'backdrop';
        this.container.className = 'modal-container';
        this.window.tabIndex = 0;
        this.window.className = 'modal';
        this.container.appendChild(this.window);
    }

    private render(): void {
        if (this.unmount) {
            return;
        }
        try {
            this.unmount = mount(this.window, <DialogContent window={this.window} container={this.container} dialog={this} />);
        } catch (error) {
            console.error('Error in dialog body', error);
        }
    }

    focus() {
        this.window.focus();
    }

    open() {
        if (this.isOpen.value) {
            return;
        }
        this.previousFocus = document.activeElement as HTMLElement;
        dialogContainer.value.appendChild(this.backdrop);
        dialogContainer.value.appendChild(this.container);
        this.render();
        this.isOpen.value = true;
    }

    close() {
        if (!this.isOpen.value) {
            return;
        }
        this.container.parentElement?.removeChild(this.container);
        this.backdrop.parentElement?.removeChild(this.backdrop);
        if (this.previousFocus) {
            this.previousFocus.focus();
        }
        if (this.unmount) {
            this.unmount();
            this.unmount = undefined;
        }
        this.isOpen.value = false;
        this.onClose.emit();
    }
}

export async function openDialog<TProps extends {}, TChoice>(
    body: DialogBody<TProps & {close: (choice: TChoice) => void}>,
    props: TProps
): Promise<TChoice|undefined> {
    let selection: TChoice|undefined;
    let doClose: (() => void)|undefined;
    const close = (choice: TChoice) => {
        selection = choice;
        if (doClose) {
            doClose();
        }
    };
    const dialog = new Dialog(body, {close, ...props});
    dialog.open();
    doClose = () => dialog.close();
    await dialog.onClose.next();
    return selection;
}

export async function openAlert(text: string, buttonText: string = 'OK'): Promise<void> {
    const button = ref<HTMLButtonElement>();
    const body = () => <div class='padding stack-column spacing'>
        <div>{text}</div>
        <div class='stack-row justify-end'>
            <button onClick={() => dialog.close()} ref={button}>{buttonText}</button>
        </div>
    </div>;
    const dialog = new Dialog(body, {});
    dialog.open();
    button.value?.focus();
    await dialog.onClose.next();
}


export interface ConfirmButton<T> {
    text: Input<string>;
    role: T;
    default?: boolean;
    dismiss?: boolean;
}

export const defaultConfirmButtons: ConfirmButton<boolean>[] = [
    {
        text: 'Cancel',
        role: false,
        dismiss: true,
    },
    {
        text: 'OK',
        role: true,
        default: true
    },
];

export async function openConfirm(text: string): Promise<boolean>;
export async function openConfirm<T>(text: string, buttons: ConfirmButton<T>[]): Promise<T>;
export async function openConfirm(text: string, buttons: ConfirmButton<any>[] = defaultConfirmButtons): Promise<any> {
    let defaultButton = ref<HTMLButtonElement>();
    let selectedRole: any;
    const buttonComponents = buttons.map(button => {
        const click = () => {
            selectedRole = button.role;
            dialog.close();
        };
        const buttonRef = ref<HTMLButtonElement>();
        if (button.default) {
            defaultButton = buttonRef;
        }
        if (button.dismiss) {
            selectedRole = button.role;
        }
        return <button onClick={click} ref={buttonRef}>{button.text}</button>;
    });
    const body = () => <div class='padding stack-column spacing'>
        <div>{text}</div>
        <div class='stack-row justify-end spacing'>
            {buttonComponents}
        </div>
    </div>;
    const dialog = new Dialog(body, {});
    dialog.open();
    defaultButton.value?.focus();
    await dialog.onClose.next();
    return selectedRole;
}

export async function openPrompt(
    text: string,
    value: string = '',
    buttons: ConfirmButton<boolean>[] = defaultConfirmButtons,
): Promise<string|undefined> {
    let result: string|undefined;
    const buttonComponents = buttons.map(button => {
        const click = () => {
            if (!button.role) {
                dialog.close();
            }
        };
        const buttonRef = ref<HTMLButtonElement>();
        return <button type={button.role ? 'submit' : 'button'} default={button.default} onClick={click} ref={buttonRef}>{button.text}</button>;
    });
    const input = new TextControl(value);
    const inputElement = ref<HTMLInputElement>();
    function submit(e: Event) {
        e.preventDefault();
        result = input.value;
        dialog.close();
    }
    const body = () => <form class='padding stack-column spacing' onSubmit={submit}>
        <Field control={input}>
            <label>{text}</label>
            <div>
                <input type='text' ref={inputElement}/>
            </div>
        </Field>
        <div class='stack-row justify-end spacing'>
            {buttonComponents}
        </div>
    </form>;
    const dialog = new Dialog(body, {});
    dialog.open();
    inputElement.value?.select();
    await dialog.onClose.next();
    return result;
}
