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
    this._sepia = props.sepia ?? 0;
    this._zIndex = props.zIndex ?? 3;
    this._glass.style.backdropFilter = `blur(${this._blur}px) sepia(${this._sepia}%)`;
    this._glass.style.zIndex = this._zIndex;
  }

  attach() {
    document.body.prepend(this._glass);
    document.body.appendChild(this._div);
  }

  hide() {
    this._div.classList.remove("glass");
    this._glass.style.display = "none";
    this._div.style.display = "none";
    this.visible = false;
    this._glass.style.zIndex = this._zIndex;
    this._div.style.zIndex = this._zIndex;
  }

  show(props = {}) {
    this._glass.style.display = "block";
    this._div.style.display = "block";
    this.visible = true;
    if (props) {
      this._glass.style.zIndex = props.glass ?? this._zIndex;
      this._div.style.zIndex = props.msgs ?? this._zIndex;
    }
  }

  showSmall() {
    this._div.style.display = "block";
    this._div.classList.add("glass");
    this.visible = true;
  }

  toggle() {
    if (this.visible) {
      this.hide();
      this._div.style = "";
    } else {
      this.show();
    }
  }

  html(content, cssprops = {}) {
    this._div.innerHTML = content;
    for (let prop in cssprops) {
      this._div.style[prop] = cssprops[prop];
    }
  }

  text(content) {
    this._div.textContent = content;
  }

  div(d) {
    this._div.innerHTML = "";
    this._div.appendChild(d);
  }
}
