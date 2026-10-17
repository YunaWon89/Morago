import { useParams } from "react-router-dom";
import { Documents } from "../../components/Documents";
import { PageHead } from "./ui";

export function AdminDocuments() {
  const id = Number(useParams().id);
  return (
    <>
      <PageHead
        title="Documents"
        crumbs={[{ label: "Home", to: "/admin" }, { label: "Translator", to: "/admin/translators" }, { label: "Documents" }]}
      />
      <div style={{ maxWidth: 520 }}>
        <Documents userId={id} />
      </div>
    </>
  );
}
