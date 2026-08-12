export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  );
}
