/**
 *  Belgingur's precipitation scale.
 */
export const COLORS = {
  standard: [
    [0.0, "#ffffff00"],
    [0.01, "#e6ff0080"], // Barely detectable
    [0.25, "#99ff4cbf"],
    [1.0, "#4ce633"], // 1mm
    [2.5, "#00cd00"],
    [5.0, "#008b00"],
    [10.0, "#08590d"], // 1cm
    [15.0, "#1161ab"],
    [20.0, "#1e90ff"],
    [25.0, "#00b2ee"],
    [30.0, "#00eeee"],
    [40.0, "#8464c6"],
    [50.0, "#890089"],
    [60.0, "#8b0000"],
    [75.0, "#cd0000"],
    [100.0, "#ee4000"], // 10cm
    [125.0, "#ff7f00"],
    [175.0, "#cd8500"],
    [250.0, "#ffd700"],
    [400.0, "#f2f20c"],
    // From here repeat scale with saturation-=20% and brightness*=2/3 and some adjustments
    // These numbers will hopefully never ever be used for the precipitation rate!
    [500.0, "#739940"], // 50cm
    [600.0, "#1b871b"],
    [750.0, "#135e13"],
    [1000.0, "#123d15"], // 1m
    [1250.0, "#1d4e80"],
    [2000.0, "#2668ab"],
    [2500.0, "#207c9e"],
    [4000.0, "#209e9e"],
    [5000.0, "#665585"],
    [6000.0, "#5c125c"],
    [7500.0, "#5e1313"],
    [10000, "#871b1b"], // 10m
    [12500, "#9e4120"],
    [20000, "#ab6722"],
    [40000, "#966c1e"],
    [50000, "#ab9622"], // 50m
    [60000, "#abab22"],
    [100000, "#000000"], // 100m
  ],

  tok: [
    [0.0, "#ffffff"],
    [1.0, "#c8f4fd"], // 1mm
    [5.0, "#a2dcf7"],
    [10, "#5e9ad2"], // 1cm
    [15, "#0a6eff"],
    [20, "#14ff64"],
    [25, "#49b34d"],
    [30, "#006400"],
    [40, "#ffff4b"],
    [50, "#f9c64e"],
    [70, "#f5742d"],
    [90, "#d62528"],
    [110, "#ecd0fc"], // >1m
    [130, "#cb7ef6"],
    [160, "#950fdf"],
    [190, "#ccfcfc"],
    [220, "#33fcfc"],
    [250, "#00bedc"],
    [280, "#007697"],
    [400, "#0f2c32"], // Belgingur additions for extreme conditions
    [1000, "#80322c"],
  ],
};

export const BELGINGUR_SCALE = COLORS.standard;
