// Formato único de retorno das Server Actions do admin (client só precisa saber "deu certo?" e,
// quando não, a mensagem pronta pra mostrar). `id` serve pra navegar depois de criar algo.
export type ActionResult = { ok: true; id?: string; message?: string } | { ok: false; message: string };

export const INVALID_INPUT: ActionResult = { ok: false, message: "Dados inválidos. Recarregue a página e tente de novo." };
