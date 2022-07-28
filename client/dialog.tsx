import { bind, Component, createElement, Dynamic, Emitter, Field, Fragment, Input, mount, ref, TextControl } from "cstk";
import { Icon } from "./icon";

export const dialogContainer = bind<HTMLElement>(document.body);

function DialogContent({container, window, dialog}: {
    container: HTMLElement,
    window: HTMLElement,
    dialog: Dialog,
}, context: JSX.Context): JSX.Element {
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
    return <Dynamic component={dialog.body} dialog={dialog}/>;
}

export class Dialog {
    private backdrop: HTMLElement = document.createElement('div');
    private container: HTMLElement = document.createElement('div');
    private window: HTMLElement = document.createElement('div');
    private previousFocus?: HTMLElement;
    private unmount?: () => void;
    readonly body = bind<Component<{dialog: Dialog}>|undefined>(undefined);
    readonly isOpen = bind(false);
    readonly onClose = new Emitter<void>();
    readonly canClose = bind(true);
    readonly modal = bind(false);

    constructor() {
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

export async function openAlert(text: string, buttonText: string = 'OK'): Promise<void> {
    const dialog = new Dialog();
    const button = ref<HTMLButtonElement>();
    dialog.body.value = () => <div class='padding stack-column spacing'>
        <div>{text}</div>
        <div class='stack-row justify-end'>
            <button onClick={() => dialog.close()} ref={button}>{buttonText}</button>
        </div>
    </div>;
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
    const dialog = new Dialog();
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
    dialog.body.value = () => <div class='padding stack-column spacing'>
        <div>{text}</div>
        <div class='stack-row justify-end spacing'>
            {buttonComponents}
        </div>
    </div>;
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
    const dialog = new Dialog();
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
    dialog.body.value = () => <form class='padding stack-column spacing' onSubmit={submit}>
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
    dialog.open();
    inputElement.value?.select();
    await dialog.onClose.next();
    return result;
}

export async function openDialog(component: Component<{dialog: Dialog}>) {
    const dialog = new Dialog();
    dialog.body.value = component;
    dialog.open();
    await dialog.onClose.next();
}
