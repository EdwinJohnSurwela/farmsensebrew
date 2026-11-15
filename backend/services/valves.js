/**
 * The plot's three valves and the nodes each one waters.
 * Must match VALVE_NODES in esp32_valve_controller/config.h: the valve box
 * opens a valve when any node listed on its row is switched on.
 */
const VALVES = [
  { n: 1, side: "west", nodes: [1, 4] },
  { n: 2, side: "centre", nodes: [3] },
  { n: 3, side: "east", nodes: [2, 5] },
];

const byNumber = (n) => VALVES.find((v) => v.n === Number(n)) || null;
const ofNode = (node) => VALVES.find((v) => v.nodes.includes(Number(node))) || null;
/** The node switched on to open a valve (its first node), e.g. valve 3 -> "NODE_02". */
const nodeIdFor = (v) => `NODE_${String(v.nodes[0]).padStart(2, "0")}`;

module.exports = { VALVES, byNumber, ofNode, nodeIdFor };
