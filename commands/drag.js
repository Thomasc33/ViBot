const Discord = require('discord.js')


async function drag(message, userToDrag) {
    // Make sure that the command was sent in a server (not a DM)
    if (!message.guild) {
      return message.channel.send("This command can only be used in a server.");
    }
  
    // Check if the user has the "MOVE_MEMBERS" permission
    if (!message.member.hasPermission("MOVE_MEMBERS")) {
      return message.channel.send("You don't have permission to use this command.");
    }
  
    // Check if the user mentioned a user to drag
    if (!userToDrag) {
      return message.channel.send("You must mention a user to drag.");
    }
  
    // Get the voice channel that the user is currently in
    const userVoiceChannel = message.member.voice.channel;
    if (!userVoiceChannel) {
      return message.channel.send("You must be in a voice channel to use this command.");
    }
  
    // Get the user that you want to drag
    const draggedUser = message.mentions.members.first();
    if (!draggedUser) {
      return message.channel.send("You must mention a valid user to drag.");
    }
  
    // Check if the user is in a voice channel
    if (!draggedUser.voice.channel) {
      return message.channel.send("The user you mentioned is not in a voice channel.");
    }
  
    // Drag the user to your voice channel
    try {
      draggedUser.voice.setChannel(userVoiceChannel);
    } catch (error) {
      console.error(error);
      return message.channel.send("An error occurred while trying to drag the user.");
    }
  
    message.channel.send(`Successfully dragged ${draggedUser.displayName} to your voice channel.`);
  }
  