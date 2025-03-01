export { metaP };

class MetaP {
  constructor() {
    this.metaPModal = document.createElement("DIV");
    this.metaPModal.id = "metap-modal";
    this.searchText = "";
    this.oldp = window.print;
    this.selectedCommand = null;
    this.inputBuffer = "";

    this.searchInputDisplay = document.createElement("DIV");
    this.searchInputDisplay.id = "metap-search-input";
    this.searchInputDisplay.classList.add("metap-inputs");
    this.metaPModal.appendChild(this.searchInputDisplay);

    this.numberInputDisplay = document.createElement("DIV");
    this.numberInputDisplay.id = "metap-number-input";
    this.numberInputDisplay.classList.add("metap-inputs");
    this.metaPModal.appendChild(this.numberInputDisplay);

    Array.from(this.metaPModal.querySelectorAll(".metap-inputs")).map(
      (inp) => (inp.style.display = "none"),
    );
    this.commandListContainer = document.createElement("DIV");
    this.commandListContainer.id = "metap-command-list";
    this.metaPModal.appendChild(this.commandListContainer);
  }

  bind(commands) {
    window.print = null;
    document.body.appendChild(this.metaPModal);
    this.commands = commands;
    const isMac =
      /Mac|iPod|iPhone|iPad/.test(navigator.platform) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    document.addEventListener("keydown", (ev) => {
      const cmd = isMac ? ev.metaKey : ev.ctrlKey;
      if (ev.key === "p" && cmd) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        this.metaP();
        return;
      }
      this.handler(ev);
    });
  }

  toggle() {
    if (this.metaPModal.style.display === "block") {
      this.metaPModal.style.display = "none";
      Array.from(this.metaPModal.querySelectorAll(".metap-inputs")).map(
        (inp) => (inp.style.display = "none"),
      );
    } else {
      this.metaPModal.style.display = "block";
      this.updateDisplay();
    }
    this.resetState();
  }

  metaP() {
    this.commandListContainer.innerHTML = "";
    this.commands.forEach((d, index) => {
      const div = document.createElement("DIV");
      div.innerText = d.title;
      div.classList.add("metap-modal-row");
      div.style.display = "block";

      div.lambda = d.lambda;

      div.addEventListener("click", () => {
        this.selectCommand(d);
      });
      div.dataset.index = index;
      this.commandListContainer.appendChild(div);
    });
    this.updateDisplay();
    this.toggle();
  }

  selectCommand(command) {
    if (command.inputType === "number") {
      this.selectedCommand = command;
      this.inputBuffer = "";
    } else {
      command.lambda();
      this.toggle();
    }
    this.updateDisplay();
  }

  resetState() {
    this.selectedCommand = null;
    this.inputBuffer = "";
    this.searchText = "";

    Array.from(this.metaPModal.querySelectorAll(".metap-inputs")).map(
      (inp) => (inp.style.display = "none"),
    );
    this.updateDisplay();
  }

  updateDisplay() {
    this.searchInputDisplay.innerText = this.searchText;
    if (this.searchText) {
      this.searchInputDisplay.style.display = "block";
    }
    this.numberInputDisplay.innerText =
      this.selectedCommand && this.selectedCommand.inputType === "number"
        ? "# " + this.inputBuffer
        : "";

    if (this.selectedCommand && this.selectedCommand.inputType === "number") {
      this.numberInputDisplay.style.display = "block";
    }

    const ps = Array.from(this.commandListContainer.querySelectorAll("DIV"));
    const matches = ps.filter((p) =>
      p.textContent.toLowerCase().includes(this.searchText.toLowerCase()),
    );
    ps.forEach((p) => (p.style.display = "none"));
    matches.forEach((p) => (p.style.display = "block"));
  }

  handler(ev) {
    if (this.metaPModal.style.display === "block") {
      ev.preventDefault();
      ev.stopPropagation();

      if (this.selectedCommand && this.selectedCommand.inputType === "number") {
        if (ev.key === "Enter") {
          const number = parseInt(this.inputBuffer, 10);
          if (!isNaN(number)) {
            this.selectedCommand.lambda(number);
            this.toggle();
          }
          return;
        } else if (ev.key.match(/^[0-9]$/)) {
          this.inputBuffer += ev.key;
          this.updateDisplay();
          return;
        } else if (ev.key === "Backspace") {
          this.inputBuffer = this.inputBuffer.slice(0, -1);
          this.updateDisplay();
          return;
        }
      }

      if (ev.key.match(/^[0-9]$/)) {
        const index = parseInt(ev.key, 10) - 1;
        const ps = Array.from(
          this.commandListContainer.querySelectorAll("DIV"),
        );
        const commandDiv = ps[index];
        if (commandDiv) {
          const command = this.commands[parseInt(commandDiv.dataset.index)];
          this.selectCommand(command);
          return;
        }
      }

      if (ev.key === "Backspace") {
        this.searchText = this.searchText.slice(0, -1);
      } else if (ev.key === "Escape") {
        if (this.searchText != "") {
          this.searchText = "";
        } else {
          this.toggle();
          return;
        }
      } else if (ev.key === "Enter") {
        const ps = Array.from(
          this.commandListContainer.querySelectorAll("DIV"),
        );
        const vizP = ps.filter((p) => p.style.display === "block");
        if (vizP.length === 0) {
          this.toggle();
          return;
        }
        const commandIndex = parseInt(vizP[0].dataset.index);
        const command = this.commands[commandIndex];
        this.selectCommand(command);
        return;
      } else if (ev.key.length === 1) {
        this.searchText += ev.key;
      }

      this.updateDisplay();
    }
  }
}

const metaP = new MetaP();
