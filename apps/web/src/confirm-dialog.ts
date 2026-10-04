export function confirmGoTo(
  doc: Document,
  targetTitle: string,
  labels: { goTo: string; confirm: string; cancel: string }
): Promise<boolean> {
  return new Promise((resolve) => {
    const backdrop = doc.createElement('div');
    backdrop.className = 'confirm-dialog-backdrop';

    const dialog = doc.createElement('div');
    dialog.className = 'confirm-dialog';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');

    const message = doc.createElement('p');
    message.textContent = labels.goTo.replace('{{title}}', targetTitle);

    const actions = doc.createElement('div');
    actions.className = 'confirm-dialog-actions';

    const confirmBtn = doc.createElement('button');
    confirmBtn.className = 'confirm-dialog-btn-confirm';
    confirmBtn.textContent = labels.confirm;

    const cancelBtn = doc.createElement('button');
    cancelBtn.className = 'confirm-dialog-btn-cancel';
    cancelBtn.textContent = labels.cancel;

    actions.append(cancelBtn, confirmBtn);
    dialog.append(message, actions);
    backdrop.append(dialog);
    doc.body.append(backdrop);

    const cleanup = () => {
      doc.removeEventListener('keydown', handleKeydown);
      backdrop.remove();
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup();
        resolve(false);
      }
    };

    confirmBtn.addEventListener('click', () => {
      cleanup();
      resolve(true);
    });

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(false);
    });

    doc.addEventListener('keydown', handleKeydown);

    confirmBtn.focus();
  });
}
