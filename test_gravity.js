import fs from 'fs';
import { brainMode1 } from './src/brainMode1.js';
import rule from './src/rule.js';

const mapData = JSON.parse(fs.readFileSync('./data/map.json', 'utf-8'));
const machines = mapData.machines || [];
const cqis = mapData.cqis || [];

console.log(`Total machines: ${machines.length}, Total CQIs: ${cqis.length}`);

// Test with all running machines
const runningMachines = machines.map(m => ({ ...m, status: 'RUNNING' }));
const config = {
  core: 14,
  nonCoreData: [{ name: "NC 1" }, { name: "NC 2" }, { name: "NC 3" }, { name: "NC 4" }],
  longshift: 2
};

const plan = brainMode1.generatePlan(runningMachines, cqis, config, mapData);
console.log(`Plan generated with ${plan.length} slots.`);

let totalAllocated = 0;
plan.forEach(s => {
  totalAllocated += (s.machines ? s.machines.length : 0);
  console.log(`Slot ${s.name || s.id} (Line ${s.line}): ${s.machines.length} machines, Core: ${s.coreNames?.join(', ')}, NC: ${s.nonCore?.join(', ')}, LS: ${s.longshift?.join(', ')}`);
});

console.log(`Total machines allocated: ${totalAllocated} / ${runningMachines.length}`);
const validation = rule.validate(plan, runningMachines);
console.log(`Validation valid: ${validation.valid}`);
if (!validation.valid) {
  console.log(`Violations:`, validation.violations);
}
