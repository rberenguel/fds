export { Msgs };

class Msgs {
  constructor(props = {}) {
    this._div = document.createElement("DIV");
    this._glass = document.createElement("DIV");
    this._div.id = "msgs-main";
    this._glass.id = "msgs-glass";
    this.visible = false;
    this.hide();
    this._blur = props.blur ?? 10;
    this._zIndex = props.zIndex ?? 3;
    this._glass.style.backdropFilter = `blur(${this._blur}px)`;
    this._glass.style.zIndex = this._zIndex;
  }

  attach() {
    document.body.prepend(this._glass);
    document.body.appendChild(this._div);
  }

  hide() {
    console.log("HIDING THE THING");
    console.log(this._div);
    this._div.classList.remove("glass");
    this._glass.style.display = "none";
    this._div.style.display = "none";
    this.visible = false;
  }

  show() {
    console.log("SHOWING THE THING");
    this._glass.style.display = "block";
    this._div.style.display = "block";
    this.visible = true;
  }

  showSmall() {
    console.log("SHOWING THE SMALL THING");
    this._div.style.display = "block";
    this._div.classList.add("glass");
    this.visible = true;
  }

  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  html(content) {
    this._div.innerHTML = content;
  }

  text(content) {
    this._div.textContent = content;
  }
}
