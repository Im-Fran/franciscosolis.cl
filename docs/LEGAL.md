# Legal pages

The site is operated by a company, and the legal pages have to say so. This document explains where
each half of that lives, because the two halves are stored in different places on purpose.

## The two halves

**The identity of the issuer** — razón social, RUT, giro, domicilio, correo de contacto,
jurisdicción — is code: `src/lib/company.ts`. It is rendered by `src/components/footer.tsx`, by the
identity block at the top of `src/pages/legal/legal.tsx`, by the corporate email signature in
`src/pages/auth/account/signature/build-signature.ts`, and by the `Organization` JSON-LD in
`index.html`.

Keeping it in code rather than in the documents means the company is identified on every page of the
site, in both languages, and — for `/legal` in particular — even when the CMS is unreachable and no
document can be rendered at all. It also means the address cannot drift between the footer, the
signature and the terms, which is the discrepancy that is awkward to explain later.

None of it is translated. A razón social is the string inscribed in the register; only the labels
around it come from `src/translations/{es,en}/legal.json` and `common.json`.

**The text of the documents** is content: it lives in the CMS, is served by `GET /cms/legal` and
`GET /cms/legal/{slug}`, and is edited at `/cms/legal`. See [CMS.md](./CMS.md).

## The sources in this repository

`docs/legal/` holds the Markdown that should be published in the CMS:

| File                        | CMS slug           | Locale |
| --------------------------- | ------------------ | ------ |
| `terms-of-service.es.md`    | `terms-of-service` | `es`   |
| `terms-of-service.en.md`    | `terms-of-service` | `en`   |
| `privacy-policy.es.md`      | `privacy-policy`   | `es`   |
| `privacy-policy.en.md`      | `privacy-policy`   | `en`   |

These files are the drafting copy, not the live text: publishing is a paste into the editor at
`/cms/legal/:id`, per locale. Edit here first so the repository keeps the history and a review can
happen on a diff, then publish — a document changed only in the CMS leaves this folder stale, and
the next person to edit it from here will silently revert the change.

`/legal` splits a document at its top-level `##` headings to reveal it section by section, so every
clause needs to start with one. Anything before the first `##` is kept as a leading section rather
than dropped, but there is no reason to write one.

## Filling in the RUT

`RUT` in `src/lib/company.ts` is empty until the number is confirmed. Every place that shows it
omits the row while it is empty, so nothing renders a blank field — but nothing shows the RUT
either. Setting that one constant puts it in the footer, in the `/legal` identity block and in the
email signature at once.

The `Organization` JSON-LD in `index.html` is the exception: it is static markup in the document
head, read by crawlers before any script runs, so its `taxID` has to be filled in by hand in the
same commit. There is a comment there saying so.

## What is deliberately not claimed

The documents say the Company processes data on behalf of clients as an *encargado* (processor) and
not as controller. That distinction is what keeps the Privacy Policy accurate: the systems built for
a client hold that client's data under that client's policy, not this one.

The terms no longer state that refunds are refused under all circumstances, nor that the user bears
the legal costs of any dispute. Both are unenforceable against a consumer in Chile —
Ley N° 19.496 makes those rights non-waivable in advance — and a clause a court would strike is
worse than no clause, because it makes the rest of the document look drafted the same way. What
replaced them is a refund process governed by the applicable contract and a liability cap tied to
the amount actually paid.

None of this is legal advice, and none of it has been reviewed by a lawyer. It is a drafting pass
that puts the company's identity in place and removes the clauses most likely to be void; a review
before the next version is a good idea.
