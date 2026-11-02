/** tripsz.social — ponto único de importação das rotas (as peças ficam em arquivos menores). */
export { fail, guard } from "./socialShared";
export { getMyProfile, getUserProfile, updateMyProfile } from "./socialProfiles";
export { blockUser, followUser, listBlocks, listFriends, respondRequest, unblockUser, unfollowUser } from "./socialGraph";
export { reportTarget } from "./socialReports";
export { getFeed, listProfilePosts } from "./socialFeed";
export { createPost, deletePost, getVisitedStadiums } from "./socialPosts";
export { addComment, deleteComment, likePost, listComments, unlikePost } from "./socialEngage";
export { stadiumsNear } from "./socialCheckin";
