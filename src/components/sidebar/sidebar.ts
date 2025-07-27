// src/components/sidebar.ts
export function initSidebar() {
  console.log("initSidebar called");
  
  // Try direct manipulation instead of hook
  const menu = document.querySelector('#sidebar-tabs menu.flexcol');
  console.log("Found menu:", menu);
  
  if (menu) {
    addAIButton(menu);
  } else {
    // Fallback to hook if DOM not ready
    Hooks.on("renderSidebar", (sidebar, html) => {
      console.log("renderSidebar hook fired");
      const menu = html.querySelector('menu.flexcol');
      if (menu) addAIButton(menu);
    });
  }
}

function addAIButton(menu: Element) {
  console.log("Adding AI button");
  
  // Create the li container
  const listItem = document.createElement('li');
  
  // Create the button
  const aiButton = document.createElement('button');
  aiButton.type = 'button';
  aiButton.className = 'ui-control plain icon fa-solid fa-robot';
  aiButton.setAttribute('data-action', 'tab');
  aiButton.setAttribute('data-tab', 'ai-chat');
  aiButton.setAttribute('role', 'tab');
  aiButton.setAttribute('aria-pressed', 'false');
  aiButton.setAttribute('data-group', 'primary');
  aiButton.setAttribute('aria-label', 'AI Assistant');
  
  aiButton.onclick = () => {
    console.log("AI Chat clicked!");
  };
  
  // Add notification pip
  const notificationPip = document.createElement('div');
  notificationPip.className = 'notification-pip';
  
  listItem.appendChild(aiButton);
  listItem.appendChild(notificationPip);
  
  // Insert before the collapse button
  const collapseButton = menu.querySelector('li:last-child');
  menu.insertBefore(listItem, collapseButton);
  
  console.log("AI button added");
}