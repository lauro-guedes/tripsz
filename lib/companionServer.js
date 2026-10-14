/** Marcar amigos — ponto único de importação das rotas (as peças ficam em arquivos menores). */
export { COMPANION_ERRORS, fail } from "./companionShared";
export { listFriends, searchFriend } from "./companionFriends";
export { listCompanionsForGames, tagCompanions } from "./companionTags";
export { listCompanionRequests, respondToRequest } from "./companionRequests";
