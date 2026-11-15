// Shared SweetAlert2 helpers — toasts and confirm dialogs.
import Swal from 'sweetalert2';

const toaster = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 2600,
  timerProgressBar: true,
});

export const toast = {
  success: (title) => toaster.fire({ icon: 'success', title }),
  error: (title) => toaster.fire({ icon: 'error', title }),
  info: (title) => toaster.fire({ icon: 'info', title }),
  warning: (title) => toaster.fire({ icon: 'warning', title, timer: 5000 }),
};

/** Pretty confirm — resolves true when the user confirms. */
export async function confirmDialog({
  title,
  text = '',
  confirmText = 'Yes',
  danger = false,
}) {
  const res = await Swal.fire({
    title,
    text,
    icon: danger ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: 'Cancel',
    confirmButtonColor: danger ? '#a8322a' : '#2f6b3a',
    reverseButtons: true,
  });
  return res.isConfirmed;
}
