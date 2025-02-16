import { plot } from "./plot.js";
import { nodes, links } from "./universe.js";
const plotted = plot(nodes, links);

const suns = plotted.suns;
const routes = plotted.routes;

let searchText = "";

window.addEventListener("keydown", (e) => {
  if (e.key === "Control" || e.key === "Tab") {
  }
  if (e.key === "Backspace") {
    searchText = searchText.slice(0, -1);
  } else if (e.key === "Escape") {
    searchText = "";
  } else if (e.key === "Enter") {
    const targets = suns.filter((n) =>
      n.system.name.startsWith(searchText.toUpperCase()),
    );
    console.log(targets);
    if (targets.size() === 1) {
      targets.dispatch("click");
      searchText = "";
      return;
    }
  } else if (e.key.length === 1) {
    searchText += e.key;
  }
  if (searchText.length < 2) {
    return;
  }
  console.log(searchText);
  routes.classed("highlighted-link", false);
  const targets = suns.filter((n) =>
    n.system.name.startsWith(searchText.toUpperCase()),
  );
  targets.dispatch("mouseover");
});

/*
const systemsToFind = ["LAVE", "DISO"]
let found = {}
let minDist = 1e50
let closeness = []

console.log(generateEliteName(seededRnd(69674063)))
console.log(generateEliteName(seededRnd(69673865)))



for(let i=50000000;i<100000000;i++){
  const name =generateEliteName(seededRnd(i))
  if(systemsToFind.includes(name)){
    found[name] = i
    const otherDist = found[systemsToFind.filter(n => n!=name)] ?? -10000
    minDist = Math.min(Math.abs(i -otherDist), minDist)
    if(Math.abs(i -otherDist) < 1000){
      closeness.push([i, otherDist, minDist])
    }
  }
}
console.log(found)
console.log(minDist)
console.log(closeness)
*/
