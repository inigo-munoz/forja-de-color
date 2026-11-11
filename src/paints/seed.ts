import type { Inventory, Paint } from './paint';

// The Vallejo Game Color BSL set the user owns: 12 families × 4, each listed lightest → darkest
// as printed on the box. Names come from the user's list; display colours were sampled once by
// hand from the Vallejo colour chart in assets-src/ and are approximate. BSL roles (base / shadow
// / light / fourth) are pending until confirmed from the user's book.
const FAMILIES: Array<[family: string, paints: Array<[code: string, name: string, hex: string]>]> = [
  ['BSL Warm Flesh', [['72.003', 'Carne Pálida', '#c9a47f'], ['72.100', 'Carne Rosada', '#e58a6b'], ['72.107', 'Piel de Atenea', '#c85c53'], ['72.108', 'Piel de Súcubo', '#923d45']]],
  ['BSL Flesh', [['72.098', 'Carne Élfica', '#ebd7b9'], ['72.099', 'Piel', '#e3ac86'], ['72.004', 'Piel de Elfo', '#cb8854'], ['72.071', 'Piel de Bárbaro', '#926640']]],
  ['BSL Yellow', [['72.109', 'Amarillo Tóxico', '#e9d457'], ['72.005', 'Amarillo Lunar', '#eeb800'], ['72.006', 'Amarillo Soleado', '#f5a300'], ['72.007', 'Amarillo Dorado', '#d47618']]],
  ['BSL Orange', [['72.110', 'Naranja Atardecer', '#f4983a'], ['72.008', 'Naranja Fuego', '#ea5b1e'], ['72.009', 'Naranja Tostado', '#e23a1e'], ['72.106', 'Sangre Escarlata', '#c02321']]],
  ['BSL Magenta', [['72.013', 'Rosa Pulpo', '#c779a5'], ['72.014', 'Púrpura', '#882451'], ['72.113', 'Magenta Profundo', '#632543'], ['72.112', 'Rojo Maligno', '#461e27']]],
  ['BSL Violet', [['72.114', 'Púrpura Lujurioso', '#b88bbd'], ['72.076', 'Púrpura Alienígena', '#7160a8'], ['72.015', 'Púrpura Hechicero', '#4b2751'], ['72.116', 'Púrpura Medianoche', '#2c1f33']]],
  ['BSL Blue', [['72.118', 'Azul Amanecer', '#73c9ec'], ['72.021', 'Azul Mágico', '#016ca7'], ['72.020', 'Azul Imperial', '#272948'], ['72.019', 'Azul Negro', '#1f2430']]],
  ['BSL Turquoise', [['72.096', 'Verdín', '#86c8a9'], ['72.119', 'Aguamarina', '#027b74'], ['72.024', 'Halcón Milenario', '#006261'], ['72.120', 'Turquesa Abisal', '#1d3e55']]],
  ['BSL Cold Green', [['72.121', 'Verde Espectral', '#83c193'], ['72.025', 'Verde Malicioso', '#02a37d'], ['72.026', 'Verde Jade', '#007254'], ['72.027', 'Verde Casposo', '#1f4e45']]],
  ['BSL Green', [['72.122', 'Verde Bilioso', '#d5d900'], ['72.032', 'Verde Escorpena', '#4e8437'], ['72.123', 'Verde Angelical', '#31502a'], ['72.028', 'Verde Oscuro', '#1e3b26']]],
  ['BSL Black', [['72.001', 'Blanco Calavera', '#ffffff'], ['72.049', 'Gris Muralla', '#9c9382'], ['72.155', 'Gris Carbón', '#373639'], ['72.051', 'Negro', '#000000']]],
  ['BSL Multipurpose', [['72.011', 'Rojo Visceral', '#7d201f'], ['72.042', 'Piel de Parásitos', '#a35e1c'], ['72.124', 'Marrón Gargona', '#592f22'], ['72.045', 'Marrón Carbonizado', '#442b26']]],
];

const paints: Paint[] = FAMILIES.flatMap(([family, entries]) =>
  entries.map(([code, name, hex], i) => ({
    brand: 'Vallejo',
    code,
    name,
    range: 'Game Color',
    type: 'opaque' as const,
    hex,
    family: { name: family, order: (i + 1) as 1 | 2 | 3 | 4 },
  })),
);

export const SEED_INVENTORY: Inventory = {
  paints,
  brushes: [
    { code: 'B02001', name: 'Detail núm. 1' },
    { code: 'B02002', name: 'Detail núm. 2' },
    { code: 'B07001', name: 'Dry Brush Small' },
  ],
};
