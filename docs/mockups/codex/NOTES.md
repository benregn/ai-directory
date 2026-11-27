# Design directions

## Variant A — split inspector

The category-count strip and narrow search controls sit above a dense sortable table, with a fixed inspector on the right to keep comparison context visible while exploring one product. The design trades some table width and row count for a useful selected-product view with summary, metadata, features, and related items. The screenshot implies selection and sorting but cannot show live filtering, keyboard navigation, or scrolling. Image generation preserved the overall layout and key counts, but some generated row metadata and summaries are inaccurate; treat this as a composition study, not a data-accurate prototype.

## Variant B — full-width terminal

This direction uses a dark, full-width table with compact filters, category cues, and 20 visible rows to maximize scan-throughput. It gives up the immediate long-form product view; a row would need to open a separate inspector or detail state. The static image cannot convey sorting, hover feedback, or the behavior of the filters. It includes the supplied sample names and several exact star/license values, but generated text and some categories/deployment values are unreliable, so the screenshot is a visual direction rather than a faithful data rendering.

## Variant C — terminal-dense table

This pass compresses the toolbar to a short count/filter strip and makes the table full-width, single-line, and tightly ruled so 30 distinct entries fit in one 1440×900 view at roughly 28px per row. The eight full-directory category counts and the 239 total are visible above the rows, while per-row detail is intentionally reduced to scan-friendly fragments and compact metadata. Rows after the 12 supplied examples are plausible illustrative entries to demonstrate the no-duplication density target; generated summaries and some row values are not authoritative. The static image cannot show sorting, filtering, or how the directory behaves beyond the visible 30 rows.
