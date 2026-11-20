# 3D Studio — livraison progressive, sans nuits blanches

## Objectif
Obtenir dans le cockpit Metaverse Creator une **vraie scène 3D manipulable** puis un asset GLB visible, sans prétendre qu'un modèle mock est une génération IA. Conserver le coeur neutre vis-à-vis de Blacklace Island.

## Contraintes non négociables
- Une PR par étape, changements petits et réversibles; ne pas fusionner si tests échouent.
- Pas de nouveaux secrets, ni appels Meshy/Tripo payants sans accord explicite.
- Ne pas modifier Octopus Engine, Publisher, Gérard ou les programmations dans cette phase.
- Aucun fallback silencieux : afficher distinctement « mock », « hors ligne », « en attente d'exécuteur » et « génération réelle ».
- Arrêter chaque étape après build/tests et rapporter les preuves, erreurs et limites.

## Étape A — prévisualisation locale (première PR de code)
- Ajouter une vue « 3D Studio » au cockpit React, avec Three.js, scène vide, grille, axes, caméra orbitale, redimensionnement et nettoyage des ressources.
- Ajouter un objet procédural local de démonstration (sans fournisseur externe), supprimable, avec mention explicite « démo locale ».
- Compatible écran mobile et mouvement réduit; pas de dépendance au Worker pour afficher la scène.
- Critères : `npm run build` du cockpit réussit, la scène s'affiche et s'oriente au pointeur/tactile, aucune requête de génération externe.

## Étape B — prévisualisation GLB
- Charger dans la vue un GLB retourné par `/jobs/:jobId/model.glb` uniquement après succès.
- Afficher nom du fournisseur et statut mock/réel; préserver le téléchargement existant.
- Tester avec le triangle GLB mock et un GLB de fixture; gérer erreur réseau et fichier invalide.

## Étape C — génération procédurale
- Construire un petit catalogue de primitives (sol, roche, végétation stylisée, lumières) depuis une description structurée, sans API payante.
- Valider schéma, limites d'objets et budget de rendu avant création.
- Sauvegarde/export versionnés après tests; aucune promesse de monde persistant avant stockage réel.

## Étape D — IA réelle (conditionnelle)
- Vérifier le `/health` déployé, l'exécuteur `content.generate` et la stabilité de son registre.
- Vérifier les identifiants fournisseurs par indicateurs booléens, jamais par exposition de secrets.
- Obtenir l'autorisation de coût avant une unique génération externe, puis vérifier statut, GLB et import.

## Définition de terminé
Une étape est terminée seulement avec code, test, preuve de fonctionnement et limites connues. Pas de déclaration « opérationnel » fondée uniquement sur README, mock ou réponse HTTP 202.
