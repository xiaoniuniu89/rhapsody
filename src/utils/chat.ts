export function initAIChat() {
  Hooks.on("chatMessage", (chatLog, message, chatData) => {
    if (message.startsWith("!ai ")) {
      const aiPrompt = message.substring(4);
      handleAIPrompt(aiPrompt);
      return false; // Prevent normal message
    }
  });
}

async function handleAIPrompt(prompt: string) {
  // Show user message
  await ChatMessage.create({
    content: `<strong>You:</strong> ${prompt}`,
    type: CONST.CHAT_MESSAGE_TYPES.OOC
  });

  // AI response
  setTimeout(async () => {
    await ChatMessage.create({
      content: `<strong>AI GM:</strong> I'm thinking about that...`,
      type: CONST.CHAT_MESSAGE_TYPES.OOC
    });
  }, 1000);
}
