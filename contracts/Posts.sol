// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Posts {
    struct Post {
        uint256 id;
        address author;
        string text;
        uint256 createdAt;
        uint256 likes;
    }

    address public immutable owner;
    uint256 private nextId;

    mapping(uint256 => Post) private posts;
    uint256[] private postIds;
    mapping(uint256 => uint256) private idPosition;
    mapping(uint256 => mapping(address => bool)) private liked;

    event PostCreated(uint256 indexed id, address indexed author, string text);
    event PostDeleted(uint256 indexed id, address indexed author);
    event AllPostsDeleted(address indexed owner, uint256 count);
    event PostLiked(uint256 indexed id, address indexed user, uint256 likes);
    event PostUnliked(uint256 indexed id, address indexed user, uint256 likes);

    constructor() {
        owner = msg.sender;
    }

    modifier postExists(uint256 id) {
        require(posts[id].author != address(0), "post not found");
        _;
    }

    function createPost(string calldata text) external returns (uint256 id) {
        require(bytes(text).length > 0, "text is empty");

        id = nextId++;
        posts[id] = Post(id, msg.sender, text, block.timestamp, 0);
        idPosition[id] = postIds.length;
        postIds.push(id);

        emit PostCreated(id, msg.sender, text);
    }

    function getPosts() external view returns (Post[] memory) {
        Post[] memory result = new Post[](postIds.length);
        for (uint256 i = 0; i < postIds.length; i++) {
            result[i] = posts[postIds[i]];
        }
        return result;
    }

    function getPostsByAuthor(address author) external view returns (Post[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < postIds.length; i++) {
            if (posts[postIds[i]].author == author) {
                count++;
            }
        }

        Post[] memory result = new Post[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < postIds.length; i++) {
            if (posts[postIds[i]].author == author) {
                result[j++] = posts[postIds[i]];
            }
        }
        return result;
    }

    function deletePost(uint256 id) external postExists(id) {
        require(posts[id].author == msg.sender, "not the author");

        uint256 position = idPosition[id];
        uint256 lastId = postIds[postIds.length - 1];
        postIds[position] = lastId;
        idPosition[lastId] = position;
        postIds.pop();
        delete idPosition[id];
        delete posts[id];

        emit PostDeleted(id, msg.sender);
    }

    function deleteAllPosts() external {
        require(msg.sender == owner, "not the owner");

        uint256 count = postIds.length;
        for (uint256 i = 0; i < count; i++) {
            uint256 id = postIds[i];
            delete posts[id];
            delete idPosition[id];
        }
        delete postIds;

        emit AllPostsDeleted(msg.sender, count);
    }

    function likePost(uint256 id) external postExists(id) {
        require(!liked[id][msg.sender], "already liked");

        liked[id][msg.sender] = true;
        posts[id].likes += 1;

        emit PostLiked(id, msg.sender, posts[id].likes);
    }

    function unlikePost(uint256 id) external postExists(id) {
        require(liked[id][msg.sender], "not liked");

        liked[id][msg.sender] = false;
        posts[id].likes -= 1;

        emit PostUnliked(id, msg.sender, posts[id].likes);
    }

    function hasLiked(uint256 id, address user) external view returns (bool) {
        return liked[id][user];
    }
}
