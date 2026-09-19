export interface MenuItemType<V = string> {
  value: V;
  label: string;
  /** A second line shown under the label in the open menu only. */
  description?: string;
}