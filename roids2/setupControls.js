export { presentKeyMap, keyMap, buttonMap };

import { set, get } from "../libs/3rdparty/idb-keyval.js";

import { getDeviceInput } from "../libs/controller/controlHandling.js";

let keyMap = await get("keyMap");

const commandNames = {
  moveDown: "Back thrusters (move forward)",
  moveUp: "Forward thrusters (move backward)",
  moveLeft: "Rotate left",
  moveRight: "Rotate right",
  shoot: "Fire primary weapon",
  secondaryShoot: "Fire secondary weapon",
  menu: "Open pause menu",
};

/* The controls below are reversed from how my mental
   model of the game is because this is what people
   seem to expect */

if (keyMap === undefined) {
  keyMap = {
    ArrowUp: "moveDown",
    ArrowDown: "moveUp",
    ArrowLeft: "moveLeft",
    ArrowRight: "moveRight",
    Space: "shoot",
    Enter: "secondaryShoot",
    KeyQ: "menu",
  };
}

let buttonMap = await get("buttonMap");

if (buttonMap === undefined) {
  buttonMap = {
    b15: "moveRight",
    b14: "moveLeft",
    b13: "moveUp",
    b12: "moveDown",
    b1: "shoot",
    b2: "secondaryShoot",
  };
}

const rmap = (m) => {
  let reversed = {};
  for (let k in m) {
    reversed[m[k]] = k;
  }
  return reversed;
};

const presentKeyMap = (d, gameActions, msgs, menu) => {
  if (!d.querySelector(".control-list-go-back")) {
    const rkeymap = rmap(keyMap);
    const rbuttonmap = rmap(buttonMap);
    const e = (t) => document.createElement(t);
    const wrapper = e("DIV");
    const desc = e("P");
    desc.innerHTML =
      "Tap on the keys or buttons to customise them. The settings will persist in your browser's <code>LocalStorage</code>.";
    wrapper.classList.add("control-list-wrapper");
    const table = e("TABLE");
    wrapper.appendChild(table);
    const headerRow = e("tr");
    table.appendChild(headerRow);
    const headerAction = e("th");
    const headerButton = e("th");
    const headerKey = e("th");
    headerAction.innerText = "Action";
    headerButton.innerText = "Button";
    headerKey.innerText = "Key";
    headerRow.append(headerAction, headerKey, headerButton);

    for (let action in gameActions) {
      const row = e("tr");
      table.appendChild(row);
      const tda = e("td");
      const tdb = e("td");
      const tdk = e("td");
      tda.classList.add("action-name");
      tdb.classList.add("action-pad");
      tdk.classList.add("action-key");

      const oldkey = rkeymap[action];
      const oldbutton = rbuttonmap[action];
      tdk.addEventListener("click", async (ev) => {
        tdk.innerText = "???";
        const nk = await getDeviceInput("keyboard");
        tdk.innerText = nk;
        keyMap[nk] = action;
        delete keyMap[oldkey];
        await set("keyMap", keyMap);
        setTimeout(() => (menu.ignoresKeys = false), 100);
      });
      tdb.addEventListener("click", async (ev) => {
        tdb.innerText = "???";
        const nb = await getDeviceInput("gamepad");
        tdb.innerText = `b${nb}`;
        buttonMap[`b${nb}`] = action;
        delete buttonMap[oldbutton];
        await set("buttonMap", buttonMap);
        setTimeout(() => (menu.ignoresKeys = false), 100);
      });
      tda.innerText = commandNames[action];
      tdb.innerText = oldbutton;
      tdk.innerText = oldkey;
      row.append(tda, tdk, tdb);
    }
    d.appendChild(wrapper);
    const back = e("DIV");
    back.innerText = "Go back";
    back.classList.add("control-list-go-back");
    wrapper.appendChild(back);
    back.addEventListener("click", () => {
      msgs.hide();
    });
  }
};
