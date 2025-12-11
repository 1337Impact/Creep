# New Features/changes

## issues:
**chat interface issue**:
    - dark mode not working properly. 
    - chat interface model dropdown not working.
**selection popup inteface issue**:
    - selection popup input message seems to strech out to cover submit button. 
    - commnads drowpdown get's covered by the input borders and dosn't show, seems like a z-index issue. 
    - model answer should be shown in the same message box and styling that ChatInterface component uses.

- only feed the screenshot and page content to llm on first request (not on every request)
- refactor screenshot button, replace the screenshot button with a "take screenshot" button. this will take a screenshot and attach it to chat, similar to how chatgpt ui handles image input. 
    * allow for a max of 3 image "screenshots" attached to chat
    * after message is sent, the attached screenshot are remove from current message context and are kept as context in the original message that they where attached to it.

## refactor Chat interface:
- the Ai helper button on the side of screen to be movable. can be dragged and droped to any side of the screen.
- when chat interface is opened we use the position of the ai helper button to position it in left or right of window, y position doesn't change.
- chat interface popup to have resisable width and height. using import { Resizable } from 're-resizable';
- 