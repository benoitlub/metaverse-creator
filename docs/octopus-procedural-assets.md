# Création procédurale via Octopus

Ce parcours local permet de décrire une caisse ou un robot statique, de prévisualiser le GLB et d'insérer le modèle dans la scène du navigateur. Quatre couleurs sont reconnues : bleu, rouge, vert et doré. Les descriptions qui ne désignent pas un seul type pris en charge sont rejetées.

## Essai local

Lancer Octopus Engine depuis son dépôt avec `PORT=3095 npm run dev`. Dans Metaverse Creator, démarrer le Worker avec les paramètres de test suivants.

```sh
npm run dev -- --local --ip 127.0.0.1 --port 8787 \
  --var OCTOPUS_ENGINE_URL:http://127.0.0.1:3095 \
  --var OCTOPUS_ENGINE_MOCK:false \
  --var THREE_D_PROVIDER:procedural
```

Enregistrer l'exécuteur dans **l'Octopus local**. Le registre est en mémoire, donc répéter cette commande après un redémarrage d'Octopus.

```sh
curl -fsS http://127.0.0.1:3095/adapters/register \
  -H 'Content-Type: application/json' \
  -d '{"id":"metaverse-procedural","name":"Metaverse Creator procedural planner","capabilities":["asset.procedural.plan"],"executeUrl":"http://127.0.0.1:8787/adapters/procedural/execute"}'
```

Lancer `npm run dev` dans `cockpit/` et ouvrir **AI / Generation**. Demander « une caisse rouge », puis « un robot bleu ». Pour chaque résultat, ouvrir **Preview in 3D Studio**, puis **Insert into local scene**. Les commandes de placement déplacent, tournent et retirent les modèles.

## Stockage et périmètre

Octopus transmet la mission au planificateur procédural. Celui-ci choisit une recette versionnée. Metaverse Creator valide la recette et reconstruit le GLB à partir de l'identifiant du job. Ce parcours ne requiert aucun fournisseur d'IA ni nouveau secret.

La scène locale conserve les identifiants des jobs et les placements dans le stockage du navigateur. Au rechargement, le Studio récupère les GLB depuis le même service. Le stockage est propre à ce navigateur et la réouverture nécessite un service accessible. La scène accepte jusqu'à 12 modèles procéduraux. Le robot est statique. Le registre local ne configure aucun exécuteur en production.
