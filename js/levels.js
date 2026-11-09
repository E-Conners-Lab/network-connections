// Each level: a parent block, the grid cell size (unit prefix), blocks that are
// already in use, and the requests the player must fit in.
// kind 'link' = point-to-point link (RFC 3021 /31 allowed).
export const LEVELS = [
  {
    id: 1, title: 'First Floor', parent: '192.168.1.0/24', unit: 28,
    brief: 'Three teams, one /24. Pick the smallest block that holds each team, then drop it on the map.',
    reserved: [],
    requests: [
      { name: 'Sales', hosts: 100 }, { name: 'Engineering', hosts: 50 }, { name: 'Guest Wi-Fi', hosts: 25 },
    ],
  },
  {
    id: 2, title: 'Mind the Gap', parent: '10.10.0.0/24', unit: 29,
    brief: 'Blocks must start on a multiple of their own size. Place the small one first and watch what breaks.',
    reserved: [],
    requests: [
      { name: 'Voice', hosts: 12 }, { name: 'Servers', hosts: 60 }, { name: 'Wired Users', hosts: 120 }, { name: 'Printers', hosts: 30 },
    ],
  },
  {
    id: 3, title: 'Point to Point', parent: '172.16.0.0/24', unit: 30,
    brief: 'Each router link needs two hosts, plus a network and broadcast address. That is a /30.',
    reserved: [],
    requests: [
      { name: 'Core to Edge A', hosts: 2 }, { name: 'Core to Edge B', hosts: 2 },
      { name: 'Core to Edge C', hosts: 2 }, { name: 'Core to Edge D', hosts: 2 },
      { name: 'Data Centre', hosts: 60 }, { name: 'Management', hosts: 28 },
    ],
  },
  {
    id: 4, title: 'Tight Squeeze', parent: '10.20.0.0/24', unit: 29,
    brief: 'These requests add up to exactly 256 addresses. One oversized block and the plan will not fit.',
    reserved: [],
    requests: [
      { name: 'Campus', hosts: 126 }, { name: 'Lab', hosts: 14 }, { name: 'Warehouse', hosts: 62 },
      { name: 'Cameras', hosts: 30 }, { name: 'Badge Readers', hosts: 14 },
    ],
  },
  {
    id: 5, title: 'Thrifty Links', parent: '10.30.0.0/25', unit: 31,
    brief: 'RFC 3021 lets a point-to-point link use a /31. Two addresses, zero waste.',
    reserved: [],
    requests: [
      { name: 'Link 1', hosts: 2, kind: 'link' }, { name: 'Link 2', hosts: 2, kind: 'link' },
      { name: 'Link 3', hosts: 2, kind: 'link' }, { name: 'Link 4', hosts: 2, kind: 'link' },
      { name: 'Link 5', hosts: 2, kind: 'link' }, { name: 'Link 6', hosts: 2, kind: 'link' },
      { name: 'Users', hosts: 30 }, { name: 'Servers', hosts: 14 }, { name: 'Loopbacks', hosts: 6 },
    ],
  },
  {
    id: 6, title: 'Branch Roll-out', parent: '10.40.0.0/22', unit: 27,
    brief: 'A /22 for five sites. The sizes add up exactly, so sequence matters.',
    reserved: [],
    requests: [
      { name: 'Branch North', hosts: 120 }, { name: 'HQ', hosts: 500 }, { name: 'Branch South', hosts: 60 },
      { name: 'Branch East', hosts: 60 }, { name: 'Regional Office', hosts: 250 },
    ],
  },
  {
    id: 7, title: 'Brownfield', parent: '10.50.0.0/23', unit: 28,
    brief: 'Grey blocks are already in use by someone else. Find the gaps that line up.',
    reserved: [
      { name: 'Legacy DMZ', cidr: '10.50.0.64/26' }, { name: 'Old Data Centre', cidr: '10.50.1.128/25' },
    ],
    requests: [
      { name: 'New Campus', hosts: 120 }, { name: 'Wi-Fi', hosts: 60 }, { name: 'IoT', hosts: 30 }, { name: 'Lab', hosts: 14 },
    ],
  },
  {
    id: 8, title: 'Campus Capstone', parent: '10.60.0.0/20', unit: 26,
    brief: 'A whole /20 for a campus build. Plan the big blocks first.',
    reserved: [],
    requests: [
      { name: 'Student Housing', hosts: 700 }, { name: 'Library', hosts: 100 }, { name: 'Admin', hosts: 200 },
      { name: 'Labs', hosts: 2000 }, { name: 'Research', hosts: 400 }, { name: 'Facilities', hosts: 50 }, { name: 'Security', hosts: 50 },
    ],
  },
];
