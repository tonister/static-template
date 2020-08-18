var currentlyDraggedItem = false;
var currentHoverTargetRow = false;
var previousHoverTargetRow = false;
var hoverTargetChanged = false;
var isDraggingSubAction = false;

var isIE11 = window.document.documentMode;
var isFF = typeof InstallTrigger !== "undefined";

/**
 * Check if array contains value
 * @param {string[]} array
 * @param {string} value
 */
function includes(array, value) {
  return array.indexOf(value) !== -1;
}

/**
 * return boolean value of provided value
 * @param {boolean, number, string} value
 */
function boolify(value) {
  var array = [true, 1, "TRUE", "true", "True"];
  if (isIE11) {
    return includes(array, value);
  }
  return array.includes(value);
}

/**
 * Add provided class to the provided element, if not already added.
 * @param {HtmlElement} element
 * @param {string} className
 */
function addClass(element, className) {
  var classNames = element.className.split(" ");
  if (classNames.indexOf(className) === -1) {
    classNames.push(className);
  }
  element.className = classNames.join(" ");
  return element;
}

/**
 * Remove provided class from the provided element
 * @param {HtmlElement} element
 * @param {string} className
 */
function removeClass(element, className) {
  var classNames = element.className.split(" ").filter(function (cn) {
    return cn !== className;
  });
  element.className = classNames.join(" ");
  return element;
}

/**
 * Returns boolean value of the provided element beign equipped with the provided class name
 * @param {HtmlElement} element
 * @param {string} className
 */
function hasClass(element, className) {
  var classNames = element.className.split(" ");
  return includes(classNames, className);
}

/**
 * Handle the dragstart event of a draggable element
 * @param {HtmlDragStartEvent} e
 */
function handleDragStart(e) {
  var breakEarly = false;

  /**
   * check for browser type for better compatibility
   * in FF and IE11 the row cannot be dragged via input with type="image"
   * and we check if the target is actually draggable="true"
   * if not, just break early
   */
  if ((isIE11 || isFF || e.target.nodeType === 3) && !e.target.draggable) {
    breakEarly = true;
  }
  /**
   * our regular DOM layout for this functionality is input(the handle)->td(the table cell)->tr(the draggable row)
   * that's why we check if the row is draggable and we are trying to drag by the actual handle
   * and we check if the actual drag handle is inside our current target
   * if not, break early
   */
  var isHandleElement = /drag-handle/.test(e.target.className);
  if (
    (isHandleElement && !e.target.parentNode.parentNode.draggable) ||
    (!e.target.querySelector("[class*='drag-handle']") && !isHandleElement)
  ) {
    breakEarly = true;
  }

  if (breakEarly) {
    e.stopPropagation();
    e.preventDefault();
    return false;
  }

  e.dataTransfer.setData("text/plain", e.target.parentNode.parentNode.id);
  e.dataTransfer.setData("Text", e.target.parentNode.parentNode.id);

  isDraggingSubAction = /_subs:/.test(e.target.parentNode.parentNode.id);
  currentlyDraggedItem = e.target.parentNode.parentNode;
} //end function

/**
 * Retrieve classNames array of event target element
 * @param {HtmlDragEnterEvent} e
 */
function getHoverTargetClasses(e) {
  /**
   * in current version of FireFox when hovering on text inside of elements, the target is of "#text" type, instead of the container
   */
  if (isFF && e.target.nodeName === "#text") {
    return e.target.parentNode.className.split(" ");
  }
  return e.target.className.split(" ");
}

/**
 * Check if user is hovering the sub-actions table
 * @param {HtmlDragEnterEvent} evt
 */
function checkIsHoveringSubActionsTable(evt) {
  var containerId = "";
  /**
   * in FireFox we need to check if we are hovering an element or plain text inside an element
   * here we check if we are hovering the text inside an element, if so, we need to use one higher level parent than on other browsers
   */
  if (evt.target.nodeName === "#text") {
    /**
     * in FF exclusively we also get event with target of text-content instead of the container
     */
    containerId =
      evt.target.parentNode.parentNode.parentNode.parentNode.className;
  } else if (["TD", "TH"].indexOf(evt.target.nodeName) !== -1) {
    containerId = evt.target.parentNode.parentNode.parentNode.className;
  }
  /**
   * check if we are hovering a sub-action tr
   */
  var isHoveringOverSubActionTd = /sub-action/.test(containerId);
  /**
   * check if we are hovering over sub-action table
   */
  var isHoveringOverSubActionTable =
    evt.target.nodeName === "TABLE" &&
    /sub-actions-table/.test(evt.target.className);
  var isHoveringOverSubActionParent = false;
  if (
    (evt.target.nodeName === "TD" &&
      currentlyDraggedItem.id.split("_")[0] ===
        evt.target.parentNode.id.split("_")[0]) ||
    (evt.target.nodeName === "#text" &&
      currentlyDraggedItem.id.split("_")[0] ===
        evt.target.parentNode.parentNode.id.split("_")[0])
  ) {
    isHoveringOverSubActionParent = true;
  }

  var subActionTableElement = false;
  var isDropAreaEnabled = false;

  if (isHoveringOverSubActionTd) {
    /**
     * if hovering over sub-action TD then need to get the sub-action TABLE as hover target
     */
    if (evt.target.nodeName === "#text") {
      subActionTableElement =
        evt.target.parentNode.parentNode.parentNode.parentNode;
    } else {
      subActionTableElement = evt.target.parentNode.parentNode.parentNode;
    }
    /**
     * check if current hover target allows dropping current draggable
     */
    isDropAreaEnabled = boolify(
      evt.target.parentNode.parentNode.parentNode.dataset.dropTarget
    );
  } else {
    /**
     * if not hovering sub-action TD then already hovering the sub-action TABLE
     */
    if (evt.target.nodeName === "#text") {
      isDropAreaEnabled = boolify(evt.target.parentNode.dataset.dropTarget);
      subActionTableElement = evt.target.parentNode;
    } else if (evt.target.nodeName === "TD") {
      isDropAreaEnabled = boolify(evt.target.parentNode.dataset.dropTarget);
      subActionTableElement = evt.target.parentNode;
    }
  }

  return {
    isHoveringParent: isHoveringOverSubActionParent,
    isHoveringTable: isHoveringOverSubActionTable,
    isHoveringTableChild: isHoveringOverSubActionTd,
    tableElement: subActionTableElement,
    isDropAreaEnabled: isDropAreaEnabled && !isHoveringOverSubActionParent
  };
}

/**
 * Check if user is hovering over drop-target of sub-actions
 * @param {HtmlDragEnterEvent} evt
 */
function checkIsHoveringSubActionsDropArea(evt) {
  /**
   * get currently hovered drop-target classNames
   * @type {string[]}
   */
  var hoverTargetClasses = getHoverTargetClasses(evt);

  if (includes(["#text", "DIV"], evt.target.nodeName)) {
    /**
     * in IE11 we need to use self-made "includes" function
     * in modern browsers we don't need to do this
     */
    return includes(hoverTargetClasses, "sub-action-drop-zone");
  }
  return false;
}

function checkIsDropAllowed(evt, subActionTable, isHoveringOverRow) {
  if (
    subActionTable.isHoveringParent ||
    subActionTable.isHoveringTable ||
    subActionTable.isHoveringTableChild
  ) {
    return subActionTable.isDropAreaEnabled;
  }
  if (isHoveringOverRow) {
    return boolify(evt.target.parentNode.dataset.dropTarget);
  }
  if (evt.target.nodeName === "#text") {
    return boolify(evt.target.parentNode.dataset.dropTarget);
  }
  return boolify(evt.target.dataset.dropTarget);
}

/**
 * Set new currentHoverTarget and previousHoverTarget
 * @param {HtmlDragEnterEvent} evt
 * @param {Object} subActionTable
 * @param {boolean} isHoveringOverRow
 */
function setHoverTargets(
  evt,
  subActionTable,
  isHoveringOverRow,
  isHoveringOverSubActionDropArea
) {
  var newHoverTarget = false;

  if (isHoveringOverSubActionDropArea) {
    if (evt.target.nodeName === "#text") {
      /**
       * in FF we need to go one level deeper into the DOM to get our sub-action drop-target
       */
      newHoverTarget = evt.target.parentNode;
    } else if (evt.target.nodeName === "DIV") {
      newHoverTarget = evt.target;
    }
  } else if (
    subActionTable &&
    (subActionTable.isHoveringTable || subActionTable.isHoveringTableChild)
  ) {
    /**
     * if user is hovering the sub-actions TABLE then use the provided table element as hover target
     */
    newHoverTarget = subActionTable.tableElement;
  } else if (isHoveringOverRow) {
    if (evt.target.nodeName === "#text") {
      /**
       * in FF we need to go one level deeper into the DOM to get our TR that is draggable
       */
      newHoverTarget = evt.target.parentNode.parentNode;
    } else if (evt.target.nodeName === "TD") {
      newHoverTarget = evt.target.parentNode;
    }
  } else {
    newHoverTarget = evt.target;
  }

  if (newHoverTarget && newHoverTarget.id !== currentHoverTargetRow.id) {
    previousHoverTargetRow = currentHoverTargetRow || false;
    currentHoverTargetRow = newHoverTarget;
    hoverTargetChanged = true;
  }
}

/**
 * Check if current target of pointer is a valid drop-target
 * @param {HtmlDragEnterEvent} e
 */
function isHoveringOverEnabledDropArea(e) {
  /**
   * check if user is hovering a tr
   */
  var isHoveringOverRow =
    e.target.nodeName === "TD" && e.target.parentNode.nodeName === "TR";
  /**
   * check if user is hovering over sub-actions table
   * also get table element and id already extracted
   */
  var subActionTable = checkIsHoveringSubActionsTable(e);

  /**
   * check if user is hovering sub-action drop-target to make sub-action into main action
   */
  var isHoveringOverSubActionDropArea = checkIsHoveringSubActionsDropArea(e);

  /**
   * check if user is hovering over drop-target that is enabled and suitable for currently hovered action
   */
  var isDropAllowed = checkIsDropAllowed(e, subActionTable, isHoveringOverRow);

  /**
   * if current target does not allow dropping OR currently dragging main action and hovering over sub-action drop area return false
   */
  if (
    !isDropAllowed ||
    (!isDraggingSubAction && isHoveringOverSubActionDropArea)
  ) {
    return false;
  }

  /**
   * set correct hover targets
   */
  setHoverTargets(
    e,
    subActionTable,
    isHoveringOverRow,
    isHoveringOverSubActionDropArea
  );

  return isHoveringOverRow || isHoveringOverSubActionDropArea;
}

/**
 * Handler for "dragenter" event
 * @param {HtmlDragEnterEvent} e
 */
function handleDragEnter(e) {
  if (isHoveringOverEnabledDropArea(e)) {
    if (hoverTargetChanged) {
      addClass(currentHoverTargetRow, "drag-enter");
      if (previousHoverTargetRow) {
        removeClass(previousHoverTargetRow, "drag-enter");
      }
      hoverTargetChanged = false;
    }
  }
}

/**
 * These are mock functions, DO NOT create these!
 */
// MOCK FUNCTIONS START //
function cursor_wait() {}
function oamSubmitForm() {}
// MOCK FUNCTIONS END //

function submitFunction(childId, parentId) {
  console.log("SubmitFunction", childId, parentId);
  cursor_wait();
  oamSubmitForm("mainForm", "drag", null, [
    ["parentId", parentId],
    ["childId", childId]
  ]);
  return false;
}

function resetFunction(childId) {
  console.log("DEBUG::resetFunction", childId);
  cursor_wait();
  oamSubmitForm("mainForm", "reset-drag", null, [["childId", childId]]);
}

function isTargetSubActionDropZone(target) {
  var classes = target.className.split(" ");
  return classes.indexOf("sub-action-drop-zone") !== -1;
}

//Function handles dragover event eg.. moving your source div over the target div element.
//If drop event occurs, the function retrieves the draggable elementâs id from the DataTransfer object.
function handleOverDrop(e) {
  e.preventDefault();
  //Depending on the browser in use, not using the preventDefault() could cause any number of strange default behaviours to occur.
  if (e.type !== "drop") {
    return; //Means function will exit if no "drop" event is fired.
  }
  //Stores dragged elements ID in var draggedId
  var draggedId = e.dataTransfer.getData("text/plain");
  if (isIE11) {
    draggedId = e.dataTransfer.getData("Text");
  }
  //Stores referrence to element being dragged in var draggedEl

  var draggedEl = document.getElementById(draggedId);
  var targetEl = false;

  if (e.target.nodeName === "#text") {
    targetEl = e.target.parentNode.parentNode;
  } else if (e.target.nodeName === "TD") {
    targetEl = e.target.parentNode;
  } else if (includes(["DIV", "TR"], e.target.nodeName)) {
    targetEl = e.target;
  }

  if (!targetEl) {
    return;
  }

  //if the event "drop" is fired on the dragged elements original drop target e.i..  it's current parentNode,
  //then set it's css class to ="" which will remove dotted lines around the drop target and exit the function.
  if (!draggedEl || draggedEl === this) {
    return;
  }
  if (/_drop/.test(e.target.id) && !/_subs/.test(draggedEl.id)) {
    return;
  }
  //Otherwise if the event "drop" is fired from a different target element, detach the dragged element node from it's
  //current drop target (i.e current perantNode) and append it to the new target element. Also remove dotted css class.
  // draggedEl.parentNode.removeChild(draggedEl);
  var childId = draggedEl.id.split("_")[0];
  var parentId = e.target.id.split("_")[0];

  if (isTargetSubActionDropZone(e.target)) {
    resetFunction(childId);
  } else {
    submitFunction(childId, parentId);
  }

  // this.appendChild(draggedEl); //Note: "this" references to the current target div that is firing the "drop" event.
  // this.className = "";
} //end Function

function registerDraggableElements() {
  var draggable = document.querySelectorAll("[class*='_row']");

  //Register event listeners for the "dragstart" event on the draggable elements:
  for (var i = 0; i < draggable.length; i++) {
    if (hasClass(draggable[i], "draggable")) {
      draggable[i].setAttribute("draggable", true);
      draggable[i].addEventListener("dragstart", handleDragStart);
      var cells = draggable[i].querySelectorAll("td");
      for (var j = 0; j < cells.length; j++) {
        cells[j].setAttribute("draggable", true);
        cells[j].addEventListener("dragstart", handleDragStart);
      }

      if (!!isIE11 || !!isFF) {
        draggable[i]
          .querySelector("[class*='drag-handle']")
          .setAttribute("style", "pointer-events: none; cursor: pointer;");
      }
    } else {
      draggable[i].addEventListener("dragstart", function (e) {
        e.preventDefault();
        return false;
      });
    }
  }
}

function registerDropTargets() {
  var targets = document.querySelectorAll(".drop-target");

  //Register event listeners for "dragover", "drop", "dragenter" & "dragleave" events on the drop target elements.
  for (var j = 0; j < targets.length; j++) {
    targets[j].setAttribute("data-drop-target", "true");
    targets[j].dataset = { dropTarget: true };
    targets[j].addEventListener("dragover", handleOverDrop);
    targets[j].addEventListener("drop", handleOverDrop);
    targets[j].addEventListener("dragenter", handleDragEnter);
  }
}

function initDragAndDrop() {
  //Retrieve two groups of elements, those that are draggable and those that are drop targets:
  registerDraggableElements();
  registerDropTargets();
}

var interval = setInterval(function () {
  if (document.querySelector(".color_table--toimingud")) {
    clearInterval(interval);
    initDragAndDrop();
  }
}, 250);
