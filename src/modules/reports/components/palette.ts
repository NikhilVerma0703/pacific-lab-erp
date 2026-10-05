/**
 * Chart colours. Categorical slots come from the validated reference palette
 * (adjacent-pair colour-blind safe, checked with the dataviz validator) and are
 * assigned in this fixed order — never cycled. Three slots sit under 3:1
 * contrast on white, so every chart also offers a Table view.
 */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"] as const;
export const OTHER_COLOR = "#9aa3ad";
export const AXIS = "#7a8896";
export const GRID = "#e8edf2";
export const INK = "#16202c";
