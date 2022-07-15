import { bind, Component, createElement, Dynamic, Emitter, Field, Fragment, Input, mount, ref, TextControl } from "cstk";
import { Icon } from "./icon";

let dialogs: Dialog[] = [];
let dragTarget: Dialog|undefined;
let dragX = 0;
let dragY = 0;

document.addEventListener('mousemove', e => {
    if (dragTarget) {
        let dx = e.clientX - dragX;
        let dy = e.clientY - dragY;
        dragTarget.move(dx, dy, e);
        dragX = e.clientX;
        dragY = e.clientY;
    }
});

document.addEventListener('mouseup', () => {
    if (dragTarget) {
        dragTarget.reposition();
        dragTarget = undefined;
    }
});

document.addEventListener('touchmove', e => {
    if (dragTarget && e.touches.length) {
        let dx = e.touches[0].clientX - dragX;
        let dy = e.touches[0].clientY - dragY;
        dragTarget.move(dx, dy, e);
        dragX = e.touches[0].clientX;
        dragY = e.touches[0].clientY;
    }
});

document.addEventListener('touchend', () => {
    if (dragTarget) {
        dragTarget.reposition();
        dragTarget = undefined;
    }
});

window.addEventListener('resize', () => {
    dialogs.forEach(dialog => dialog.reposition());
});

export function getMaxZIndex() {
    if (!dialogs.length) {
        return 100;
    }
    return 100 + dialogs.length;
}

function DialogContent({window, dialog, dragStart}: {
    window: HTMLElement,
    dialog: Dialog,
    dragStart: (event: MouseEvent|TouchEvent) => void,
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
    const focusHandler = () => dialog.raise();
    context.onInit(() => {
        window.addEventListener('keydown', keyHandler);
        window.addEventListener('focus', focusHandler, true);
        window.focus();
    });
    context.onDestroy(() => {
        window.removeEventListener('keydown', keyHandler);
        window.removeEventListener('focus', focusHandler, true);
    });
    context.onDestroy(dialog.x.getAndObserve(x => window.style.left = `${x}px`));
    context.onDestroy(dialog.y.getAndObserve(y => window.style.top = `${y}px`));
    return <Fragment>
        <div class='title-bar'>
            <div class='title-bar-text' onMouseDown={e => dragStart(e)} onTouchStart={e => dragStart(e)}>
                {dialog.title}
            </div>
            <div class='title-bar-buttons'>
                <button class='icon-only' onClick={() => dialog.close()} disabled={dialog.canClose.not}>
                    <Icon name='close'/>
                </button>
            </div>
        </div>
        <div class='window-body'>
            <Dynamic component={dialog.body}/>
        </div>
    </Fragment>;
}

export class Dialog {
    private window: HTMLElement = document.createElement('div');
    private previousFocus?: HTMLElement;
    private unmount?: () => void;
    readonly title = bind('');
    readonly body = bind<Component<{}>|undefined>(undefined);
    readonly isOpen = bind(false);
    readonly onClose = new Emitter<void>();
    readonly canClose = bind(true);
    readonly x = bind(0);
    readonly y = bind(0);
    readonly modal = bind(false);

    constructor() {
        this.window.tabIndex = 0;
        this.window.className = 'window';
        this.window.style.position = 'fixed';
    }

    private render(): void {
        if (this.unmount) {
            return;
        }
        try {
            this.unmount = mount(this.window, <DialogContent window={this.window} dialog={this} dragStart={e => this.dragStart(e)}/>);
        } catch (error) {
            console.error('Error in dialog body', error);
        }
    }

    private dragStart(event: MouseEvent|TouchEvent) {
        event.preventDefault();
        dragTarget = this;
        if (event instanceof MouseEvent) {
            dragX = event.clientX;
            dragY = event.clientY;
        } else if (event.touches.length) {
            dragX = event.touches[0].clientX;
            dragY = event.touches[0].clientY;
        }
        this.focus();
    }

    move(dx: number, dy: number, e: MouseEvent|TouchEvent) {
        this.x.value += dx;
        this.y.value += dy;
    }

    reposition() {
        const rect = this.window.getBoundingClientRect();
        if (this.y.value < 0) {
            this.y.value = 0;
        } else if (this.y.value + 50 > document.body.clientHeight) {
            this.y.value = document.body.clientHeight - 50; 
        }
        if (this.x.value + rect.width < rect.width / 2) {
            this.x.value = -rect.width / 2;
        } else if (this.x.value + rect.width / 2 > document.body.clientWidth) {
            this.x.value = document.body.clientWidth - rect.width / 2;
        }
    }

    raise() {
        const index = dialogs.indexOf(this);
        if (index >= 0 && index < dialogs.length - 1) {
            dialogs.splice(index, 1);
            dialogs.push(this);
            dialogs.forEach((dialog, index) => {
                if (dialog.modal.value) {
                    dialog.window.style.zIndex = `${100 + dialogs.length + index}`;
                } else {
                    dialog.window.style.zIndex = `${100 + index}`;
                }
            });
        }
    }

    focus() {
        this.raise();
        this.window.focus();
    }

    openAt(x: number, y: number) {
        if (this.isOpen.value) {
            return;
        }
        dialogs.push(this);
        document.body.appendChild(this.window);
        this.previousFocus = document.activeElement as HTMLElement;
        this.render();
        this.window.style.maxWidth = `${Math.ceil(document.body.clientWidth * 0.9)}px`;
        this.window.style.maxHeight = `${Math.ceil(document.body.clientHeight * 0.9)}px`;
        this.isOpen.value = true;
        const rect = this.window.getBoundingClientRect();
        if (x * 2 < document.body.clientWidth) {
            this.x.value = x + 20;
        } else {
            this.x.value = x - rect.width - 20;
        }
        if (y * 2 < document.body.clientHeight) {
            this.y.value = y + 20;
        } else {
            this.y.value = y - rect.height - 20;
        }
        dialogs.forEach((dialog, index) => dialog.window.style.zIndex = `${100 + index}`);
    }

    open(eventOrParent: MouseEvent|HTMLElement = document.body) {
        if (this.isOpen.value) {
            return;
        }
        dialogs.push(this);
        document.body.appendChild(this.window);
        this.previousFocus = document.activeElement as HTMLElement;
        this.render();
        this.window.style.maxWidth = `${Math.ceil(document.body.clientWidth * 0.9)}px`;
        this.window.style.maxHeight = `${Math.ceil(document.body.clientHeight * 0.9)}px`;
        this.isOpen.value = true;
        const rect = this.window.getBoundingClientRect();
        if (eventOrParent instanceof MouseEvent) {
            if (eventOrParent.clientX * 2 < document.body.clientWidth) {
                this.x.value = eventOrParent.clientX + 20;
            } else {
                this.x.value = eventOrParent.clientX - rect.width - 20;
            }
            if (eventOrParent.clientY * 2 < document.body.clientHeight) {
                this.y.value = eventOrParent.clientY + 20;
            } else {
                this.y.value = eventOrParent.clientY - rect.height - 20;
            }
        } else {
            const parentRect = eventOrParent.getBoundingClientRect();
            this.x.value = parentRect.left + (parentRect.width - rect.width) / 2;
            this.y.value = parentRect.top + Math.min(parentRect.height * 0.1, (parentRect.height - rect.height) / 4);
        }
        dialogs.forEach((dialog, index) => dialog.window.style.zIndex = `${100 + index}`);
    }

    close() {
        if (!this.isOpen.value) {
            return;
        }
        const index = dialogs.indexOf(this);
        if (index >= 0) {
            dialogs.splice(index, 1);
        }
        document.body.removeChild(this.window);
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

export async function openAlert(title: string, text: string, buttonText: string = 'OK'): Promise<void> {
    const dialog = new Dialog();
    dialog.title.value = title;
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

export async function openConfirm(title: string, text: string): Promise<boolean>;
export async function openConfirm<T>(title: string, text: string, buttons: ConfirmButton<T>[]): Promise<T>;
export async function openConfirm(title: string, text: string, buttons: ConfirmButton<any>[] = defaultConfirmButtons): Promise<any> {
    const dialog = new Dialog();
    dialog.title.value = title;
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
    title: string,
    text: string,
    value: string = '',
    buttons: ConfirmButton<boolean>[] = defaultConfirmButtons,
): Promise<string|undefined> {
    const dialog = new Dialog();
    dialog.title.value = title;
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
