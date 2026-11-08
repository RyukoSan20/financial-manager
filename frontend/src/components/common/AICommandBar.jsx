/*
 * The command bar.
 *
 * The bar itself now lives in one place: `components/ai/TopAiCommandBar`.
 * It is the top bar of the dashboard, with the mascot, the prompt, the
 * voice button and the four quick actions.
 *
 * This file is the name the rest of the application already used, so
 * it is kept as the way in - and there is only one copy of the bar,
 * so the two cannot drift apart.
 */

export { default } from '../ai/TopAiCommandBar';
export { QUICK_ACTIONS } from '../ai/TopAiCommandBar';
