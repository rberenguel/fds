export { System };

class System {
  constructor(props) {
    this.id = props.id;
    this.neighbors = {}; // Just to have a set
  }
  info() {
    return `System ID: ${this.id} <br> Neighbors: ${Object.keys(this.neighbors).join(", ")}`;
  }
  extendedinfo() {
    const population = "10 billion";
    const numPlanets = 5;
    const government = "Democracy";

    return `
      <h2>System ${this.id}</h2>
      <p>Population: ${population}</p>
      <p>Planets: ${numPlanets}</p>
      <p>Government: ${government}</p>
      `;
  }
  r() {
    return 0;
  }
  starSize() {
    return 1 + Math.random() * 7;
  }
  starColor() {
    const hue = Math.random() * 360;
    const saturation = 40 + Math.random() * 30;
    const lightness = 80 + Math.random() * 5;
    const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    return color;
  }
  stations() {
    return Math.floor(Math.random() * Math.random() * 6);
  }
}
