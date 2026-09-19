/**
 * A table's column widths and header row. Given to a `fixed-columns` table,
 * the widths hold whatever's in the cells, so tables with the same columns
 * line up with each other.
 */
export const FixedWidthColumns = ({
  columns,
}: {
  columns: { name: string; width: string }[];
}) => (
  <>
    <colgroup>
      {columns.map(({ name, width }) => (
        <col key={name} style={{ width }} />
      ))}
    </colgroup>
    <thead>
      <tr>
        {columns.map(({ name }) => (
          <th key={name}>{name}</th>
        ))}
      </tr>
    </thead>
  </>
);
