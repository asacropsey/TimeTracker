// Screen "Account": sign in with Microsoft, see who is signed in, check the OneDrive connection.

import { currentAccount, isSignInConfigured, signIn, signOut, SignInRequiredError } from '../auth';
import { checkConnection } from '../graph';
import { h, messages, type AppContext } from './dom';
import { banner, divider, shield } from './ornaments';

// Result of the last connection check, kept between screen refreshes.
let check: { state: 'idle' | 'checking' | 'ok' | 'error'; text: string; signInAgain?: boolean } = { state: 'idle', text: '' };

function runCheck(ctx: AppContext) {
  check = { state: 'checking', text: 'Checking the connection to OneDrive…' };
  checkConnection()
    .then((info) => (check = { state: 'ok', text: `OneDrive folder “Apps/${info.folderName}” is ready.` }))
    .catch((err) => (check = { state: 'error', text: String(err.message ?? err), signInAgain: err instanceof SignInRequiredError }))
    .finally(() => ctx.rerender());
}

export function accountView(ctx: AppContext): HTMLElement {
  const account = currentAccount();
  const body = !isSignInConfigured()
    ? h('section', { class: 'card' }, h('p', {}, 'Microsoft sign-in is not set up yet.'))
    : account
      ? signedIn(ctx, account.name ?? '', account.username)
      : signInScreen();

  return h(
    'div',
    {},
    banner('Account'),
    body,
    h('p', { class: 'small muted center' }, `This device is recorded as: ${ctx.device}`),
  );
}

/** Not signed in: the crest, the motto and one button. */
function signInScreen(): HTMLElement {
  const offline = !navigator.onLine;
  const start = () => signIn().catch((err) => alert(`Sign-in could not start.\n\n${err.message ?? err}`));
  return h(
    'section',
    { class: 'welcome' },
    h('img', { class: 'crest-small', src: `${import.meta.env.BASE_URL}crest.webp`, alt: 'Coat of arms with flame, fox and shield' }),
    h('p', { class: 'motto' }, 'SOLUS NON SOLUM'),
    divider(),
    h(
      'p',
      {},
      'Sign in with your personal Microsoft account so your entries can be kept safe in your OneDrive. ',
      'Until then, everything is saved on this device.',
    ),
    h('button', { class: 'primary big', onclick: start, disabled: offline }, 'Sign in with Microsoft'),
    offline && h('p', { class: 'small muted' }, 'You are offline. Connect to the internet to sign in.'),
  );
}

function signedIn(ctx: AppContext, name: string, email: string): HTMLElement {
  if (check.state === 'idle' && navigator.onLine) runCheck(ctx);

  const status =
    check.state === 'ok'
      ? h('p', { class: 'msg success' }, check.text)
      : check.state === 'error'
        ? messages([check.text])
        : check.state === 'checking'
          ? h('p', { class: 'muted' }, check.text)
          : h('p', { class: 'muted' }, 'You are offline. The connection will be checked when you are back online.');

  const leave = async () => {
    if (!confirm('Sign out on this device?\n\nYour entries stay saved on this device.')) return;
    await signOut();
    check = { state: 'idle', text: '' };
    ctx.rerender();
  };

  return h(
    'section',
    { class: 'card' },
    h(
      'div',
      { class: 'project-title' },
      shield((name || email).charAt(0).toUpperCase()),
      h('div', {}, h('h2', {}, name || 'Signed in'), h('div', { class: 'small muted' }, email)),
    ),
    status,
    h(
      'div',
      { class: 'actions' },
      check.signInAgain
        ? h('button', { class: 'primary', onclick: () => signIn() }, 'Sign in again')
        : h('button', { onclick: () => runCheck(ctx), disabled: check.state === 'checking' || !navigator.onLine }, 'Check connection'),
      h('button', { onclick: leave }, 'Sign out'),
    ),
  );
}
