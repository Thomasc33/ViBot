# AFK Documentation

Orignally written by MrSauron

## Rationale

- ;afk is a command which has been created and expanded upon over the course of 5 years.
- ;afk was originally built for voids and cults. It expanded in functionality as Lost Halls delved into more dungeons and ViBot expanded into more servers.
- ;afk is repetitive and disorganised. Due to many developers adding and changing functionality, the code achieves the same functionality with multiple pieces of logic
- ;afk is bloated and inefficient. There are a variety of features which are no longer used and some features utilise archaic methods for achieving their functions, making them inefficient
- ;afk is hardcoded. Features are hard to incorporate, and functionality is hard to tweak without majorly affecting all of the code.
- ;afk is not standardised. There is no single way or documented methodology for coding the command. As such, templates across dungeons have different parameters and there’s two commands to separate raiding sections, ;eafk and ;afk.

## Overview

- Build ;afk from the ground up, looking to fix all the issues and future-proof it.
- ;afk will be able to handle any template as defined by staff. Templates are completely customisable, and the parameters decide everything about the afk. Which dungeon, what the reacts are, how they behave, what is displayed, how the afk functions. It can handle new additions, removals, and changes entirely through templates.
- The code itself is streamlined, organised and modular. It is easier to follow and understand, uses standardised methods for achieving functionality. It is error-checked heavily to ensure templates are set up correctly. The code itself is expandable with features due to the modular nature. It relies entirely on parameters for displaying and creating afk checks.
- Both ;eafk and ;afk have been unified into a singular command alongside with the templates parameters. Functionality has been added while code has been reduced 1700 lines -> 1200 lines.


## Templates

### Overview

- Templates have been split into parent and children templates. Children templates  inherit from parent templates depending on the channel in which ;afk is run. Inheritance means for the children template to assume values from the parent template where parameters are undefined. This allows for a single child template to behave differently in channels as the inherited values will change depending on how the parent templates is defined.
- Inheritance works across objects where objects are merged to include unique elements from both.
- All text display-based parameters (message, description, confirmationMessage) can display emojis defined on the bot if their name is put between {} and display channels/roles if their setup name is put between [].
- Templates have a dedicated file for loading, validating, and processing the parameters for an afk check before they are used.

### Parameters

#### Base Parameters

Base parameters are parameters which are defined once per template, whether this be child template or parent template.

- inherits
  - Type: Array of Strings
  - Required: No
  - Examples:
    - null
    - []
    - ["veteran"]
    - ["normal", "veteran"]
  - Inherit is a parameter which defines the names of the parent templates from which to inherit from. The list can only contain one parent template per commands channel. The code will automatically take the first parent template which matches with the commands channel that the afk command was run from.

- category
  - Type: String
  - Required: Yes (for VC)
  - Examples:
    - null
    - "raiding"
  - Category is a parameter which defines the case-insensitive name of the discord category or folder of channels where the afk voice channel (where applicable) should be displayed. 

- templateChannel
  - Type: String
  - Required: Yes (for VC)
  - Examples:
    - null
    - "432995686678790144"
  - Template Channel is a parameter which defines the discord channel id which the afk voice channel (where applicable) should use as a template when created.

- statusChannel
  - Type: String
  - Required: Yes
  - Examples:
    - null
    - "432995686678790144"
  - Status Channel is a parameter which defines the discord channel id which the afk announcement panel and interactable raider buttons/emotes should appear.

- commandsChannel
  - Type: String
  - Required: Yes
  - Examples:
    - null
    - "432995686678790144"
  - Commands Channel is a parameter which defines the discord channel id which the afk command can be run from and where the afk commands panel and dynamic raider info should appear.

- activeChannel
  - Type: String
  - Required: Yes
  - Examples:
    - null
    - "432995686678790144"
  - Active Channel is a parameter which defines the discord channel id where the afk control panel should appear.

- enabled
  - Type: Boolean
  - Required: Yes
  - Examples:
    - null
    - true
    - false
  - Enabled is a parameter which defines whether the template is enabled or disabled.

- minStaffRoles
  - Type: List of Lists of Strings
  - Required: No
  - Examples:
    - null
    - [["almostrl"]]
    - [["lostboomer"], ["rl", "hallsBanner"], ["almostrl", "hallsbanner’]]
  - Minimum Staff Roles is a parameter which defines lists containing a list of setup role names which is the combination of staff roles needed to put up and interact with the afk control buttons. Only one list of lists needs to be met. If not defined, the default would be the command role permission. 

- minViewRaiderRoles
  - Type: List of Strings
  - Required: Yes (for VC)
  - Examples:
    - null
    - ["raider"]
  - Minimum View Raider Roles is a parameter which defines the list of setup role names to view the afk voice channel (where applicable).

- minJoinRaiderRoles
  - Type: List of Strings
  - Required: Yes (for VC)
  - Examples:
    - null
    - ["raider"]
  - Minimum Join Raider Roles is a parameter which defines the list of setup role names to join the afk voice channel (where applicable).

- name
  - Type: String
  - Required: Yes
  - Examples:
    - null
    - "Void"
    - "Exa. Void"
    - "Adv. Void"
  - Name is a parameter which defines the name which is displayed across all afk panels and the afk voice channel (where applicable). This should ideally be short.

- templateName
  - Type: String
  - Required: Yes
  - Examples:
    - null
    - "Void"
    - "Exalted Void"
    - "Advanced Void"
  - Template Name is a parameter which defines the template name which is displayed when choosing between templates with shared aliases. This should ideally be unique/descriptive.

- pingRoles
  - Type: Array of Strings
  - Required: No
  - Examples:
    - null
    - []
    - ["here"]
    - ["here", "voidPing"]
  - Ping Roles is a parameter which defines the names of the ping roles which is displayed on the message alongside the afk announcement panel. The list can only contain setup role names or "here" for @here.

- aliases
  - Type: Array of Strings
  - Required: Yes
  - Examples:
    - null
    - []
    - ["v"]
    - ["v", "void"]
  - Aliases is a parameter which defines the aliases that must be written alongside the afk command to choose the template in question. Aliases are first searched to find a perfect match and if no match is found, then they are searched by parts.

- logName
  - Type: String
  - Required: No
  - Examples:
    - null
    - "voidRuns"
  - Log Name is a parameter which defines the name in the database which is chosen to log the run under for everyone participating in the afk.

- vcOptions
  - Type: Number
  - Required: Yes
  - Examples:
    - null
    - 0
    - 1
    - 2
  - VC Options is a parameter which defines the style of VC for the afk. 0 is VC-less, 1 is Static VC and 2 is Creating a VC. 

- startDelay
  - Type: Number
  - Required: No
  - Examples:
    - null
    - 10
  - Start Delay is a parameter which defines the amount of time (in seconds) to wait before displaying the afk announcement panel. If not defined, the default would be a 0 second start delay.

- cap
  - Type: Number
  - Required: Yes
  - Examples:
    - null
    - 45
  - Cap is a parameter which defines the capacity of raiders for the afk.

- capButton
  - Type: Boolean
  - Required: Yes
  - Examples:
    - null
    - true
    - false
  - Cap Button is a parameter which defines whether the afk should display a button for setting/changing the capacity. This will dynamically change the limits of buttons which are set to 0.

- phases
  - Type: Number
  - Required: Yes
  - Examples:
    - null
    - 1
    - 2
  - Phases is a parameter which defines the number of phases in the afk. This is important for body, buttons and reacts as each of these can be customised to be changed, appear, or disappear on a per-phase basis.

- partneredStatusChannels
  - Type: Object
  - Required: No
  - The Partnered Status Channel object defines a set of dictionary-based parameters which are defined once per template, inside of partneredStatusChannels, whether this be child template or parent template. However, an indefinite number of objects (uniquely identified by name) can be defined. The object is a dictionary of guild ids and channels to additionally ping about the run starting.
  Name
The name of each object needs to be a valid guild id which is used in conjunction with the parameters in the object.

  - fields:
    - channels
      - Type: Array of Strings
      - Required: No
      - Examples:
        - null
        - []
        - ["432995686678790144"]
        - ["432995686678790144", "123995686678790789"]
      - channels is a parameter which defines the ids of channels from which to ping. This list can contain an indefinite amount of channel ids which must be part of the guild found by the guild id under the name.

- body
  - Type: Object
  - Required: Yes
  - fields:
    - Name
      - The name of each object needs to be a string with a number which corresponds to a phase limited by the total number of phases and is used in conjunction with the parameters in the object. One of these objects is "default" to define defaults on all phases which have undefined parameters.
    
    - vcState
      - Type: Number
      - Required: Yes (for VC)
      - Examples:
        - null
        - 0
        - 1
      - VC State is a parameter which defines the state of the afk voice channel (where applicable) in the current phase. 0 is Locked, 1 is Open.
    
    - nextPhaseButton
      - Type: String
      - Required: No
      - Examples:
        - null
        - "Open Channel"
        - "Start Run
      - Next Phase Button is a parameter which defines the name of the button to move to the next phase from the current phase.
    
    - timeLimit
      - Type: Number
      - Required: Yes
      - Examples:
        - null
        - 360
      - Time Limit is a parameter which defines the amount of time (in seconds) to wait before automatically moving to the next phase from the current phase.
    
    - message
      - Type: String
      - Required: No
      - Examples:
        - null
        - "Early Reacts, Click the Buttons"
        - "The Channel will be Open"
      - Message is a parameter which defines the message which is displayed alongside the afk announcement panel after moving into the current phase.
    
    - embed
      - Embed parameters are parameters which are defined once per body sub-object, whether this be a phase or default.
      - fields:
        - color
          - Type: String
          - Required: No
          - Examples:
            - null
            - "#ffffff"
          - Color is a parameter which defines the color of the embed which is a part of the afk announcement panel after moving into the current phase. If not defined, the default would be #ffffff or white.
        
        - description
          - Type: Array of Strings
          - Required: Yes
          - Examples:
            - null
            - [null]
            - [""]
            - ["A random description which perfectly encapsulates this afk."]
            - ["Before", null, "After"]
          - Description is a parameter which defines the combination of descriptions of the embed which is a part of the afk announcement panel after moving into the current phase. Every description in the array is combined to make the overall description. If not defined, a default description will be generated from the buttons and reacts. If an empty string, the section from the previous phase will be copied.
        
        - image
          - Type: String
          - Required: No
          - Examples:
            - null
            - "hallsExaltedReqsImage"
            - "https://media.discordapp.net/attachments/464829705728819220/1027309075807088760/unknown.png?width=1843&height=1228" 
          - Image is a parameter which defines the strings setup name or image of the embed which is a part of the afk announcement panel after moving into the current phase. This is usually reserved for requirement sheets.
        
        - thumbnail
          - Type: Array of Strings
          - Required: No
          - Examples:
            - null
            - ["https://media.discordapp.net/attachments/1114574154021208186/1115942912635715637/vatlKfa.png",                 "https://media.discordapp.net/attachments/1114574154021208186/1115942938019647519/bnKFZjt.png"]
          - Thumbnail is a parameter which defines the possible thumbnails of the embed which is a part of the afk announcement panel after moving into the current phase. Every thumbnail in the array is randomly chosen between for the thumbnail.


- buttons
  - Type: Object
  - Require: No
  - The Buttons object defines a set of dictionary-based parameters which are defined once per template, inside of buttons, whether this be child template or parent template. However, an indefinite number of objects corresponding to individual buttons can be defined. The object is a dictionary of the buttons of the afk check on the afk announcement panel.

  - fields:
    - Name
      - The name of each object needs to be a string which corresponds to the name (and id) of the button used in conjunction with the parameters in the object.

    - type
      - Type: Number
      - Required: Yes
      - Examples:
        - null
        - 0
        - 1
        - 2
        - 3
        - 4
      - Type is a parameter which defines the type of the current button. This will affect the core functionality of the button. 0 is Normal, a standard react button. 1 is Log, which does everything a standard react does, except also add a manual logging button at the end of the afk. 2 is Supporter, which handles supporter roles at different tiers and limits them between afks based on time. 3 is Points, which uses the inbuilt points system to allow or deny raiders, taking away their points. 4 is Drag, which is a special button that allows raiders to send media and be allowed or denied into the afk.

    - parent
      - Type: Array of Strings
      - Required: No
      - Examples:
        - null
        - ["Key"]
        - ["Key", "Vial"]
      - Parent is a parameter which defines the parent buttons of the current button. This parent button is one which is reacted to if anyone reacts to the current button. 

    - choice
      - Type: Number
      - Required: Yes
      - Examples:
        - null
        - 0
        - 1
        - 2
        - 3
      - Choice is a parameter which defines the customisability of the current button before the afk starts. 0 is no choice, where nothing happens. 1 is a yes/no choice, which allows staff with one of the minStaffRoles to choose whether to have the current button. 2 is a number choice, which allows staff with one of the minStaffRoles to choose whether to have 0, 1, 2 or 3 limit for the current button. 3 is a number choice with custom, which allows staff with one of the minStaffRoles to choose whether to have 0, 1, 2, 3 or custom limit for the current button.

    - limit
      - Type: Number
      - Required: Yes (for non-Supporter)
      - Examples:
        - null
        - 0
        - 3
        - 45
      - Limit is a parameter which defines the maximum number of reacts for the current button. 0 is special and means the button will be tied to the cap of the afk. Limit does not apply to supporter-type buttons which have separate definitions.

    - points
      - Type: Number or String
      - Required: No
      - Examples:
        - null
        - 0
        - 15
        - "mystic"
      - Points is a parameter which defines the number of points awarded to everyone after reacting to the current button. This can reference strings in the points section of setup.

    - displayName
      - Type: Boolean
      - Required: Yes
      - Examples:
        - null
        - true
        - false
      - Display Name is a parameter which defines whether the name should be displayed on the afk announcement panel for the current button.

    - emote
      - Type: String
      - Required: No
      - Examples:
        - Null
        - "VialOfPureDarkness"
      - Emote is a parameter which defines the emoji displayed on the afk announcement panel for the current button. This emoji must be defined on the bot.

    - confirm
      - Type: Boolean
      - Required: Yes
      - Examples:
        - null
        - true
        - false
      - Confirm is a parameter which defines whether anyone who reacts should be presented with a confirm panel for the current button.

    - location
      - Type: Boolean
      - Required: Yes
      - Examples:
        - null
        - true
        - false
      - Location is a parameter which defines whether anyone who reacts should be given early location for the current button.

    - minRole
      - Type: String
      - Required: No
      - Examples:
        - Null
        - "vetraider"
      - Min Role is a parameter which defines which defines the setup role name which is the minimum role to react the current button.

    - minStaffRoles
      - Type: List of Lists of Strings
      - Required: No
      - Examples:
        - null
        - [["almostrl"]]
        - [["lostboomer"], ["rl", "hallsBanner"], ["almostrl", "hallsbanner’]]
      - Minimum Staff Roles is a parameter which defines lists containing a list of setup role names which is the combination of staff roles needed to have the choice parameter apply for the current button. Only one list of lists needs to be met.

    - confirmationMessage
      - Type: String
      - Required: No
      - Examples:
        - null
        - ["A random message which perfectly encapsulates this button."]
      - Confirmation Message is a parameter which defines the confirmation message that is displayed on the confirm panel for this button.

    - confirmationMedia
      - Type: String
      - Required: No
      - Examples:
        - null
        - "https://cdn.discordapp.com/attachments/230500411835023362/1059570168558256178/how_to_drag_minefields.gif" 
      - Confirmation Media is a parameter which defines the confirmation image or GIF that is displayed on the confirm panel for this button.

    - disableStart
      - Type: Number
      - Required: No
      - Examples:
        - null
        - 0
        - 2
      - Disable Start is a parameter which defines the phase (inclusive) from which the current button should appear and be disabled. This should be less than start.

    - start
      - Type: Number
      - Required: Yes
      - Examples:
        - null
        - 0
        - 2
      - Start is a parameter which defines the phase (inclusive) from which the current button should appear and be active.

    - lifetime
      - Type: Number
      - Required: Yes
      - Examples:
        - null
        - 0
        - 1
        - 69
      - Lifetime is a parameter which defines the number of phases which the current button should stay active for.

    - logOptions
      - Type: Object
      - Required: Yes (for Log)
      - The Log Options object defines a set of dictionary-based parameters which are defined once per template, inside of each button in logOptions, whether this be child template or parent template. However, an indefinite number of objects corresponding to individual log options can be defined. The object is a dictionary of the log options of the current button.

      - fields:
        - Name
          - The name of each object needs to be a string which corresponds to the name (and id) of the log option used in conjunction with the parameters in the object.

        - logName
          - Type: Array of Strings
          - Required: Yes
          - Examples:
            - null
            - ["keypop"]
            - ["keypop", "moddedPops"]
          - Log Name is a parameter which defines the log names in the database which is chosen to log the react for when manually logging anyone for the current button.
    
        - points
          - Type: Number or String
          - Required: No
          - Examples:
            - null
            - 0
            - 15
            - "mystic"
          - Points is a parameter which defines the number of points awarded when manually logging anyone for the current button. This can reference strings in the points section of setup.
    
        - multiplier
          - Type: Number or String
          - Required: No
          - Examples:
            - null
            - 0
            - 2
            - "supportermultiplier"
          - Multiplier is a parameter which defines the multiplier on the number of points awarded when manually logging anyone for the current button. This can reference strings in the points section of setup.

- reacts
  - Type: Object
  - Required: No
  - The Reacts object defines a set of dictionary-based parameters which are defined once per template, inside of reacts, whether this be child template or parent template. However, an indefinite number of objects corresponding to individual reacts can be defined. The object is a dictionary of the reacts of the afk check on the afk announcement panel.
  - fields:
    - Name
      - The name of each object needs to be a string which corresponds to the name of the react only used for identification of the object.

    - emote
      - Type: String
      - Required: Yes
      - Examples:
        - Null
        - "VialOfPureDarkness"
      - Emote is a parameter which defines the emoji displayed on the afk announcement panel for the current react. This emoji must be defined on the bot.

    - onHeadcount
      - Type: Boolean
      - Required: Yes
      - Examples:
        - Null
        - true
        - false
      - On Headcount is a parameter which defines whether the emoji would appear on a headcount for the current react.

    - Start
      - Type: Number
      - Required: Yes
      - Examples:
        - null
        - 0
        - 2
      - Start is a parameter which defines the phase (inclusive) from which the current react should appear.

    - lifetime
      - Type: Number
      - Required: Yes
      - Examples:
        - null
        - 0
        - 1
        - 69
      - Lifetime is a parameter which defines the number of phases which the current react should stay active for.

## AfkCheck

- There is extensive error checking and validation for templates. Any issues that do not match the documentation are presented to the user with a helpful error message.
- Afks are customisable for every channel (announcements, commands, active) and are no longer tied to entire raiding sections. The commands channel defined by the template is the only place afks can be run. One such example is the ability to create testing templates by having the announcement panel appear in the commands channel.
- Afks are customisable by staff and raider roles. For staff, you can set permissions of who can run the afk command and interact with the buttons. For raiders, you can set permissions for who can see the vc, join the vc or which roles can interact with every react button separately.
- Afks can have shared aliases. When running the afk command, any aliases that are matched are presented to the user where they can choose a relevant template. If no perfect matches are found, aliases that are partially matched (as substrings) are presented to the user.
- Afks can be VC-less, Static or create a new VC. All three are supported by using the same template system (some parameters become redundant depending on the VC-type)
- Afks can have any number of phases. These phases can change which buttons appear, disappear and are active, which reacts appear and disappear and what the afk announcement panel looks like between phases. One such example is the ability to create a custom Vet template with 5 phases which may ask for different sets of reacts during every phase.
- Afks can have every part of the display on the announcement channel completely customised. This could be default generated text, custom text or a mix of the two. This also applies images, colors, thumbnails (which are randomised), time limits or vc state between phases.
- Afks now have a set cap button which can set the number of raiders per afk while it’s ongoing. Any buttons with a limit of 0 will change according to the cap.
- Through inheritance the same children afk templates can be used for multiple  raiding sections (split apart as parent templates) which changes functionality between them.
- Afk buttons are fully customisable. There is no longer a requirement to have a key, supporter, or points for all afks as these are all part of the button system. Every button can be individually customised.
- Afk buttons can have their order set by in what order they appear in the template. This applies to reacts as well.
- Afk buttons can use the choice parameter to present options for customisability depending on the staff running it. One such example is having ARLs forcibly use 1 key while RLs have the option of adding more key reacts to their afk.
- Afk buttons can use the parent parameter to connect buttons to one another. One such example is a general join button that has a role requirement with all additional react buttons being connected to the general join button so more people than the cap isn’t reached.
- Afk buttons are split into archetypes and this distinction is also made in code. This allows for easy expansion by adding a new type of button and a new function to handle it.
- Log type buttons have a new manual log button which works in conjunction with the command. It’s easier to use and directly takes the names of the people who reacted as options for logging.
- Supporter type buttons use the existing supporter system alongside customisability of the new button system.
- Points type buttons use the existing points system alongside customisability of the new button system.
- Drag type buttons allow for raiders to send screenshots of sets which appears in a temporary threads channel of the commands channel. The RL can then accept or deny sets by looking at the screenshots which automatically drags in raiders or denies them.
- Buttons update on a timer rather than on click making them far more accurate when it comes to storing numbers of every react.
- The afk command has been completely cleaned. Every variable has a purpose and there is no duplicated or redundant code or functionality.
- Afks are stored and loaded in a much more systematic manner. The same system is used to transfer afk information between commands to use in sub-commands like location and request. The information that is loaded and stored is much more descriptive compared to before.
- When regenerating or updating panels, this is done by editing the existing panel or regenerating only the parts that have been changed such that it is more efficient and can use the same functions throughout the file.
- The UI of afks has been completely overhauled to be unified across panels and generally cleaner to look at.
- Afk’s functionality is entirely dependent and underpinned on template parameters. Due to limited hardcoded features, it can drastically change functionality based on what the parameters have defined. 
- Due to the customisable nature of afk, with a suitable command or system for editing existing templates, this would allow for complete freedom and choice over what afks exist and what they do without needing to change code.
