browser.folderControls.initialize().catch(console.error);
/* global browser */
const actions = new Map([['expand-all', true], ['collapse-all', false]]);
for (const [id, expanded] of actions) {
  browser.menus.create({ id, title: expanded ? 'Expand All Folders' : 'Collapse All Folders', contexts: ['folder_pane'] });
}
async function run(id, tab) {
  if (!actions.has(id)) return;
  try {
    if (!tab) [tab] = await browser.mailTabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('Select a mail tab first');
    await browser.folderControls.setExpanded(tab.id, actions.get(id));
  } catch (error) {
    console.error('Folder Expand/Collapse All:', error);
    await browser.notifications.create({ type: 'basic', title: 'Folder Expand/Collapse All', message: error.message });
  }
}
browser.menus.onClicked.addListener((info, tab) => run(info.menuItemId, tab));
browser.commands.onCommand.addListener(id => run(id));
