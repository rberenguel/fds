export { plot };

let highlightingLinks = d3.selectAll();
let tick = 0;

const smoothStep = (a, b, x) => (
  (x -= a), (x /= b - a), x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x)
);

function drawStar(ctx, radius, color) {
  const x = 50,
    y = 50;
  const rr = radius * 2;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(x, y, 0.5 * rr, 0, 2 * Math.PI);
  ctx.fill();

  for (let k = 0; k < 20; k++) {
    const a = smoothStep(0, 10 + Math.random() * 10, k);
    const r = smoothStep(0, 10, k);
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, (1 - r) * rr, 0, 2 * Math.PI);
    ctx.fill();
  }
}

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
canvas.width = 100;
canvas.height = 100;

drawStar(ctx, 10, "#f90");

const plot = (nodes, links) => {
  const width = 2 * window.innerWidth;
  const height = 2 * window.innerHeight;
  const svg = d3
    .select("#universe-container")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("id", "universe");

  const cx = width / 2;
  const cy = height / 2;
  const myRandom = d3.randomLcg(42);
  const simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance(50),
    )
    .force("charge", d3.forceManyBody().strength(10))
    .force("center", d3.forceCenter(cx, cy))
    .force("collide", d3.forceCollide(30))
    .force("x", d3.forceX())
    .force("y", d3.forceY())
    .randomSource(myRandom);

  simulation.alphaDecay(0.0);

  simulation.on("tick", () => {
    tick++;
    node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
    node.attr("x", (d) => d.x).attr("y", (d) => d.y);
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);
  });

  simulation.alphaDecay(0.1);
  simulation.tick(100);

  simulation.stop();

  const link = svg
    .append("g")
    .attr("stroke", "var(--faded-grey)")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("class", "link");

  const node = svg
    .append("g")
    .attr("stroke-width", 1.5)
    .selectAll("g.node-container")
    .data(nodes)
    .join("g")
    .attr("class", "node-container")
    .on("mouseover", showInfo)
    .on("mouseout", hideInfo);

  const nodeImg = node.classed("sun", true).each(function (d) {
    const dis = d3.select(this);

    drawStar(ctx, d.system.starSize(), d.system.starColor());

    dis
      .append("svg:image")
      .attr("width", 50)
      .attr("height", 50)
      .attr("x", (d) => d.x - 25)
      .attr("y", (d) => d.y - 25)
      .attr("xlink:href", canvas.toDataURL()).classed("sun", true);

    if (d.system.stations() > 0) {
      for (let i = 0; i < d.system.stations(); i++) {
        dis
          .append("circle")
          .attr("cx", (d) => d.x + 2 + i * 2)
          .attr("cy", (d) => d.y + 2)
          .attr("r", 1)
          .attr("fill", "blue")
          .attr("stroke-width", "0.5")
          .attr("stroke", "white");
      }
    }
  });

  link
    .attr("x1", (d) => d.source.x)
    .attr("y1", (d) => d.source.y)
    .attr("x2", (d) => d.target.x)
    .attr("y2", (d) => d.target.y);

  node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
  node.attr("x", (d) => d.x).attr("y", (d) => d.y);

  const tooltip = d3.select("body").append("div").attr("class", "tooltip");
  function showInfo(event, d) {
    const systemInfo = d.system.info();

    tooltip.transition().duration(200).style("opacity", 0.9);

    tooltip
      .html(systemInfo)
      .style("left", event.pageX + 10 + "px")
      .style("top", event.pageY - 10 + "px");
  }

  function hideInfo() {
    tooltip.transition().duration(500).style("opacity", 0);
  }

  function highlightLinks(event, d) {
    link
      .filter((l) => l.source.id === d.id || l.target.id === d.id)
      .classed("highlighted-link", true)
      .raise();
  }

  function unhighlightLinks(event, d) {
    try {
      const highlightedIds = highlightingLinks.data().map((l) => l.index);

      link
        .filter((l) => !highlightedIds.includes(l.index))
        .classed("highlighted-link", false);
    } catch (err) {
      link.classed("highlighted-link", false);
    }
  }

  node.on("mouseover", highlightLinks).on("mouseout", unhighlightLinks);

  function showSystemInfoAndHighlight(event, d) {
    resetHighlighting();

    const systemInfoDiv = d3.select("#system-info");
    systemInfoDiv.html(d.system.extendedinfo()).style("opacity", 1);

    d3.select(this)
      .classed("highlighted-node", true)
      .attr("r", (d) => 2 * d.system.r());

    const highlighted = link.filter(
      (l) => l.source.id === d.id || l.target.id === d.id,
    );
    highlighted.classed("highlighted-link", true).raise();
    highlightingLinks = highlighted;

    const neighborIds = Object.keys(d.system.neighbors).map(Number);
    node
      .filter((n) => neighborIds.includes(n.id))
      .classed("highlighted-dest-node", true)
      .attr("r", (d) => 2 * d.system.r());
  }

  function resetHighlighting() {
    highlightingLinks = d3.selectAll();
    d3.select("#system-info").style("opacity", 0);

    node
      .classed("highlighted-node", false)
      .classed("highlighted-dest-node", false);

    link.classed("highlighted-link", false);

    node.attr("r", (d) => d.system.r());
  }

  nodeImg.on("click", showSystemInfoAndHighlight);

  svg.on("click", function (event) {
    if (!event.target.classList.contains("sun")) {
      resetHighlighting();
    }
  });

  const universe = document.getElementById("universe");
  const panzoom = Panzoom(universe, {
    maxScale: 50,
    minScale: 0.1,
  });

  universe.parentElement.addEventListener("wheel", panzoom.zoomWithWheel, {
    passive: true,
  });

  universe.parentElement.addEventListener(
    "wheel",
    function (event) {
      if (!event.shiftKey) return;

      panzoom.zoomWithWheel(event);
    },
    { passive: true },
  );
  setTimeout(() => panzoom.pan(-cx / 2, -cy / 2, { animate: true }), 100);
};
