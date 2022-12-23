import { ConsoleReporter } from "@vscode/test-electron";
import { DebugConsoleMode } from "vscode";

class pathNode{
    left: any;
    right: any;
    // Path nodes types -> series, parallel, and leaf

    constructor(public type:string, public parent:pathNode, public name:string){
        this.type = type;
        this.parent = parent;
        this.left = null;
        this.right = null;
        this.name = name;
    }

    mergePathNodes(){
        if(this.type === "series"){
            this.name = this.left.name + "-" + this.right.name;
            this.type = "leaf";
        }
        else if(this.type === "parallel"){
            this.name = "(" + this.left.name + ")" + "+" +  "(" + this.right.name + ")";
            this.type = "leaf";
        }
    }
    static createPathNodeTree(path : string, parent:pathNode){
        // console.log(path);
        let newNode = null;
        let subPaths = [];

        if(path === ""){
            return new pathNode("leaf", parent, "");
        }

        subPaths = splitMultiControlPath(path);
        if(subPaths.length !== 1){
            // console.log(subPaths);
            newNode = new pathNode("parallel", parent, "");
            let leftPath = subPaths[0];
            let rightPath = subPaths[1];
            // let rightPath = "(";
            // for(let i = 1; i < subPaths.length; i++){
            //     rightPath += subPaths[i] + "+";
            // }
            // rightPath = rightPath.substring(0, rightPath.length - 1) + ")";

            newNode.left = pathNode.createPathNodeTree(leftPath, newNode);
            newNode.right = pathNode.createPathNodeTree(rightPath, newNode);
            return newNode;
        }

        subPaths = splitPath(path);
        if(subPaths.length !== 1){
            // console.log(subPaths);
            newNode = new pathNode("series", parent, "");
            let leftPath = subPaths[0];
            let rightPath = subPaths[1];
            // for(let i = 1; i < subPaths.length; i++){
            //     rightPath += subPaths[i] + "*";
            // }
            // rightPath = rightPath.substring(0, rightPath.length - 1);

            newNode.left = pathNode.createPathNodeTree(leftPath, newNode);
            newNode.right = pathNode.createPathNodeTree(rightPath, newNode);
            return newNode;
        }
        else{ 
            if(subPaths.length < 1 || subPaths[0] === undefined){
                newNode = new pathNode("leaf", parent, "");
                return newNode;
            }
            // console.log(subPaths[0]);
            newNode = new pathNode("leaf", parent, subPaths[0]);
        }

        return newNode;
    }

    static getSimplifiedPath(root:pathNode) : any{

        if(root.type === "leaf"){
            return "(" + root.name + ")";
        }
        else if(root.type === "series"){
            let left = root.left;
            let right = root.right;

            root.name = seriesCombinationOfPath(pathNode.getSimplifiedPath(left), pathNode.getSimplifiedPath(right));
            root.type = "leaf";
            root.left = null;
            root.right = null;
            // console.log(root.name);
            return root.name;

        }
        else if(root.type === "parallel"){
            let left = root.left;
            let right = root.right;
            root.name = "(" + "(" + pathNode.getSimplifiedPath(left) + ")" + "+" + "(" + pathNode.getSimplifiedPath(right) + ")" + ")";
            root.type = "leaf";
            root.left = null;
            root.right = null;

            return root.name;
        }

    }
}

function seriesCombinationOfPath(path1 : string, path2 : string){
    // console.log(path1, path2);

    let pathArray1 = splitSeriesPathWithUnroll(path1);
    let pathArray2 = splitSeriesPathWithUnroll(path2);

    // console.log(pathArray1, pathArray2);
    // return ;
    let pathArray = pathArray1.concat(pathArray2);
    let i = pathArray1.length;
    let unroll = 1;
    for(i = pathArray1.length; i<pathArray.length; i++){
        if(pathArray[i][1] > 1){
            unroll = pathArray[i][1];
            // console.log(unroll);
            break;
        }
    }
    
    if(i === pathArray.length){
        // console.log("F");
        return combineSuffixPrefix(pathArray1, pathArray2);
    }

    // let first = getNextNode(pathArray[i][0]);

    let path = "";
    let j;
    let matched = false;
    for(j = i-1; j >=0; j--){
        path = pathArray[j][0] + "*" + path;
        if(j === i-1){
            path = path.substring(0, path.length - 1);
        }
        // console.log(path, pathArray[i][0], "\n");
        if(path === pathArray[i][0]){
            unroll++;
            matched = true;
            break;
        }
    }
    if(!matched){
        return combineSuffixPrefix(pathArray1, pathArray2);
    }
    let temp = path;
    path = "";
    for(let k = 0; k < j; k++){
        if(pathArray[k][1] > 1){
            path += "*(" + pathArray[k][0] + ")^" + pathArray[k][1];
        }
        else{
            path = path + "*" + pathArray[k][0];
        }
    }
    path += "*(" + temp + ")^" + unroll;

    for(let k = i+1; k < pathArray.length; k++){
        if(pathArray[k][1] > 1){
            path += "*(" + pathArray[k][0] + ")^" + pathArray[k][1];
        }
        else{
            path = path + "*" + pathArray[k][0];
        }
    }

    return path.substring(1);
}

function combineSuffixPrefix(pathArray1: any[], pathArray2: any[]){
    let i = pathArray1.length;
    let pathArray = pathArray1.concat(pathArray2).map((path) => {return  path[1] === 1 ? path[0] : "(" + path[0] + ")^" + path[1];});
    // console.log(pathArray);
    for(i = 0; i<pathArray.length; i++){
        for(let len = 1; len <= i; len++){
            let preffix = pathArray.slice(i, i+len).join("*");
            let suffix = pathArray.slice(i-len, i).join("*");
            if(preffix === suffix){
                let path = pathArray.slice(0, i-len).join("*") + "*(" + preffix + ")^2*" + pathArray.slice(i+len).join("*");    
                if(path[0] === "*"){
                    path = path.substring(1);
                }
                if(path[path.length-1] === "*"){
                    path = path.substring(0, path.length-1);
                }
                return path;
            }
        }
    }

    return pathArray.join("*");
}

function splitSeriesPathWithUnroll(path : string){
    // console.log(path);
    let lis: any[] = [];

    let len = path.length;
    // path = path.substring(1, len - 1);
    // len -= 2;

    let i = 0;
    let depth = 0;
    let p = "";
    // let unroll = 0;
    while(i < len){
        if(path[i] === "("){
            depth++;
        }
        else if(path[i] === ")"){
            depth--;
        }
        p += path[i];
        i++;
        if(depth === 0 && (i === len || path[i] === "*" || path[i] === "^")){
            let unroll = 1;
            // console.log(p);
            if(path[i] === "^"){
                let j = i+1;
                while(j < len && path[j] !== "-"){
                    j++;
                }
                unroll = parseInt(path.substring(i + 1, j));
                p = p.substring(1, p.length - 1);
                i = j;
            }
            lis.push([p, unroll]);
            p = "";
            i++;
        }
    }

    return lis;    
}

function parseProofFile(file : string){
    let parsedOutput = {};

    /* 
        PARSE Product Graph
            - Get all nodes
            - Get all edges
            - Rename nodes with row,col
            - Parse the correlated paths in required format
    */

    let productGraph = {};
    let productGraphNodes = [];
    let productGraphEdges = [];
    let srcGraphNodesMap = {};
    let dstGraphNodesMap = {};

    productGraphNodes = getGraphNodes("product", file);
    //console.log("productGraphNodes = ");
    //for (let node of productGraphNodes) {
    //    console.log(node[0] + ", " + node[1]);
    //}
    //console.log(productGraphNodes);
    productGraphEdges = getGraphEdges("product", file);

    
    productGraph = {"nodes": productGraphNodes, "edges": productGraphEdges};
    //console.log("Product Graph Nodes and Edges parsed(wihtout formatting)");
    //console.log(productGraph);


    srcGraphNodesMap = getSrcNodesMap(file);
    dstGraphNodesMap = getDstNodesMapFromFile(file);

    let res = formatProductGraphEdges(productGraph, srcGraphNodesMap, dstGraphNodesMap);

    // console.log("Product Graph Nodes and Edges formatted");

    productGraph = res["productGraph"];
    if(dstGraphNodesMap === null){
        dstGraphNodesMap = res["dstGraphNodesMap"];
    }


    
    return productGraph;
}



function getGraphNodes(graph : string, file : string){
    let nodes: any = [];
    let fileLines = file.split('\n');
    let res = [];
    if(graph === "product"){
        let idx = fileLines.indexOf("=graph_with_guessing") + 1;
        nodes = fileLines[idx].substring(8).split(' ');

        for(let i = 0; i < nodes.length; i++){
            res.push(nodes[i].split("_"));
        }
    }
    else if(graph === "src"){
        let idx = fileLines.indexOf("=src_tfg") + 4;
        nodes = fileLines[idx].substring(8).split(' ');

        for(let i = 0; i < nodes.length; i++){
            res.push(nodes[i]);
        }
    }
    else if(graph === "dst"){
        let idx = fileLines.indexOf("=dst_tfg") + 4;
        nodes = fileLines[idx].substring(8).split(' ');

        for(let i = 0; i < nodes.length; i++){
            res.push(nodes[i]);
        }
    }

    return res;
}

function getGraphEdges(graph : string, file : string){
    let edges = [];
    let fileLines = file.split('\n');
    
    if(graph === "product"){
        let idx = fileLines.indexOf("=graph_with_guessing") + 3;
        while(fileLines[idx] !== "=graph done"){
            let edge = fileLines[idx].split(" => ");

            let path1Idx = fileLines.indexOf("=Edge: " + fileLines[idx]) + 4;
            let path2Idx = path1Idx + 5;

            edges.push({"from": edge[0], "to": edge[1], "path1": fileLines[path1Idx], "path2": fileLines[path2Idx]});
            idx++;
        }
    }


    return edges;
}


function getSrcNodesMap(file : string){
    let srcNodeMap :{ [id: string] : string; }  = {};

    let fileLines = file.split('\n');
    let idx = fileLines.indexOf("=PC_to_line_and_column:") + 1;
    let end = fileLines.indexOf("=PC_to_line_and_column done");

    while(idx < end){
        let node = fileLines[idx + 1];
        let rc = fileLines[idx + 3].substring(1, fileLines[idx + 3].length - 1).split(" ");
        let line = parseInt(rc[1], 10);
        let col = 0;
        if(rc.length >= 4){
            col = parseInt(rc[4], 10);
        }
        else{
            rc = fileLines[idx + 3].split(" ");
            line = parseInt(rc[1], 10);
            col = 1;
        }

        srcNodeMap[node] = "S_" + line + "_" + col;
        if(node.endsWith("%d")){
            srcNodeMap[node.substring(0, node.length - 2) + "%bbentry"] = "S_" + line + "_" + col;
        }
        idx += 4;
    }
    //console.log(srcNodeMap);
    return srcNodeMap;
}

function getDstNodesMapFromFile(file: string){
    let dstNodeMap :{ [id: string] : string; }  = {};

    let fileLines = file.split('\n');
    let idx = fileLines.indexOf("=PC_to_line_and_column:") + 1;
    let temp = idx;
    idx = fileLines.slice(idx+1).indexOf("=PC_to_line_and_column:");

    if(idx === -1){
        return null;
    }
    idx = idx + temp + 1 + 1;
    let end = fileLines.slice(idx).indexOf("=PC_to_line_and_column done") + idx;


    while(idx < end){
        let node = fileLines[idx + 1];
        let rc = fileLines[idx + 3].substring(1, fileLines[idx + 3].length - 1).split(" ");
        let line = parseInt(rc[1], 10);
        let col = 0;
        if(rc.length >= 4){
            col = parseInt(rc[4], 10);
        }
        else{
            rc = fileLines[idx + 3].split(" ");
            line = parseInt(rc[1], 10);
            col = 1;
        }

        dstNodeMap[node] = "D_" + line + "_" + col;
        if(node.endsWith("%d")){
            dstNodeMap[node.substring(0, node.length - 2) + "%bbentry"] = "D_" + line + "_" + col;
        }
        idx += 4;
    }
    //console.log(dstNodeMap);
    return dstNodeMap;
}

function getDstNodesMap(nodesSet : Set<string>){
    let dstNodeMap : {[id : string] : string}= {};



    for(let node of nodesSet){
        let line = parseInt(node.substring(1).split("%")[0]) + 1;
        dstNodeMap[node] = "A_" + line;
        // if(node.endsWith("%1")){
        //     dstNodeMap[node.substring(0, node.length - 2) + "%0"] = "A_" + line;
        // }
    }
    return dstNodeMap;
}

function formatProductGraphEdges(productGraph : any, srcGraphNodesMap : any, dstGraphNodesMap : any){
    // Formats the correlated path string in edges
    // Formats all nodes in product graph
    // Also returns the set of node in the dst graph
    // console.log(productGraph);

    let dstGraphNodesSet = new Set<string>();
    let productGraphEdges = productGraph["edges"];
    let productGraphNodes = productGraph["nodes"];


    for(let edge of productGraphEdges){
        // console.log(edge);
        let path1 = edge["path1"];
        let path2 = edge["path2"];

        // console.log(path1);
        // console.log(path2);
        
        
        let root1 = pathNode.createPathNodeTree(path1, null);
        let root2 = pathNode.createPathNodeTree(path2, null);
        
        path1 = pathNode.getSimplifiedPath(root1);
        // console.log("Path 1 simplified By PathNode");
        path2 = pathNode.getSimplifiedPath(root2);
        // console.log("Path 2 simplified By PathNode");

        let res1 = newSimplify(path1);
        console.log("Path 1 simplified", res1);
        let res2 = newSimplify(path2);
        console.log("Path 2 simplified", res2);

        // console.log(path1);
        // console.log(res1.path, "\n");

        edge["path1"] = res1.path;
        edge["path2"] = res2.path;

        res2.nodes.forEach((node) => {dstGraphNodesSet.add(node);});
        // console.log("\n");
    }

    // console.log("Edge Siplification Done");

    if(dstGraphNodesMap === null){
        dstGraphNodesMap = getDstNodesMap(dstGraphNodesSet);
    }

    for(let edge of productGraphEdges){
        let path1 = edge["path1"];
        let path2 = edge["path2"];

        let res1 = formatPathString(path1, srcGraphNodesMap);
        let res2 = formatPathString(path2, dstGraphNodesMap);


        edge["path1"] = res1;
        edge["path2"] = res2;

    }

    // console.log("Path Formatting Done");

    for(let node of productGraphNodes){
        node[0] = mapNodes(node[0], srcGraphNodesMap);
        node[1] = mapNodes(node[1], dstGraphNodesMap);
    }

    for(let edge of productGraphEdges){
        let from = edge["from"].split("_");
        let to = edge["to"].split("_");

        from = [mapNodes(from[0], srcGraphNodesMap), mapNodes(from[1], dstGraphNodesMap)];
        to = [mapNodes(to[0], srcGraphNodesMap), mapNodes(to[1], dstGraphNodesMap)];

        edge["from"] = from;
        edge["to"] = to;
    }

    // console.log("Node Formatting Done");

    productGraph = {"nodes": productGraphNodes, "edges": productGraphEdges};
    let res = {"productGraph": productGraph, "dstGraphNodesMap": dstGraphNodesMap};

    return res;
}

function mapNodes(node:string, nodeMap:any){
    let newNodeName = "";
    if(node.startsWith("L0")){
        newNodeName = "start";
    }
    else if(node.startsWith("E")){
        newNodeName = "end";
    }
    else if(!isNaN(parseInt(node))){
        newNodeName = node;
    }
    else{
        newNodeName = nodeMap[node];
    }
    return newNodeName;
}

export function newSimplify(path:string){

    let nextEdge = getNextEdge(path);
    let nextIdx = 0;
    let prevIdx = 0;
    let newPath = "";

    let nodes = new Set();

    while(nextEdge !== null){
        // console.log(nextEdge);
        let edge = nextEdge.edge;
        let idx = nextEdge.idx + nextIdx;
        prevIdx = nextIdx;
        // if(nextEdge != null)
        nextIdx = idx + edge.length;

        let sp = path.substring(nextIdx);

        nextEdge = getNextEdge(sp);

        if(nextEdge === null){
            newPath += path.substring(prevIdx, idx);
            let nn = edge.substring(1, edge.length-1).split('=>');
            if(applicableNode(nn[0]) && applicableNode(nn[1])){
                newPath += nn[0] + "*" + nn[1];
                nodes.add(nn[0]);
                nodes.add(nn[1]);
            }
            else if(applicableNode(nn[0])){
                newPath += nn[0];
                nodes.add(nn[0]);
            }
            else if(applicableNode(nn[1])){
                newPath += nn[1];
                nodes.add(nn[1]);
            }
            else{
                if (newPath[newPath.length-1] === "*"){
                    newPath = newPath.substring(0, newPath.length-1);
                }
            }
            // console.log(newPath, nextIdx, newPath.length);
            newPath += sp;
            // console.log(sp);

        }
        else{
            newPath += path.substring(prevIdx, idx);

            let nn = edge.split('=>')[0].substring(1);
            if(applicableNode(nn)){
                newPath += nn;
                nodes.add(nn);
            }
            else{
                if (newPath[newPath.length-1] === "*"){
                    newPath = newPath.substring(0, newPath.length-1);
                }
            }
        }
        // console.log(newPath);
    }
    return {path:newPath.split('*').join('-'), nodes:nodes};
}
/*
function simplifyPathString(path : string){
    // Simplify the path string to remove unnecessary nodes
    // Convert to required format
    // Returns path and set of nodes in the path

    // console.log(path);

    let newPath = "";
    let nodesSet = new Set<string>();

    let idx = 0;
    let depth = 0;
    let maxDepth = 0;
    if(path[idx] === "("){
        while(idx < path.length){
            if(path[idx] === "("){
                depth++;
            }
            else if(path[idx] === ")"){
                depth--;
            }

            maxDepth = Math.max(maxDepth, depth);

            if(depth === 0){
                break;
            }
            idx++;
        }
        // console.log(maxDepth, idx);
        if(idx < path.length-1){
            path = "(" + path + ")";
        }
    }

    let subPaths = splitMultiControlPath(path);

    if(subPaths.length !== 1){
        // console.log(subPaths);
        for(let i = 0; i < subPaths.length; i++){
            let subPath = subPaths[i];
            let res = simplifyPathString(subPath);

            if(res.path === ""){
                continue;
            }
            
            newPath += "(" + res.path + ")" + "+";
            nodesSet = new Set<string>([...nodesSet, ...res.nodes]);
        };
        newPath = "(" + newPath.substring(0, newPath.length - 1) + ")";

        return {path: newPath, nodes: nodesSet, multiple:true};
    }

    idx = 0;
    depth = 0;
    maxDepth = 0;
    if(path[idx] === "("){
        while(idx < path.length){
            if(path[idx] === "("){
                depth++;
            }
            else if(path[idx] === ")"){
                depth--;
            }

            maxDepth = Math.max(maxDepth, depth);

            if(depth === 0){
                break;
            }
            idx++;
        }
        // console.log(maxDepth, idx);
        if(idx === path.length-1 && maxDepth > 1){
            path = path.substring(1, path.length - 1);
        }
    }
    // console.log(path);
    subPaths = splitSeriesPathWithUnroll(path);
    if(subPaths.length !== 1){
        // console.log(subPaths);
        let last = subPaths[subPaths.length - 1][0];
        let unroll = subPaths[subPaths.length - 1][1];

        if(unroll === 1 && splitMultiControlPath(last).length === 1 && splitSeriesPathWithUnroll(last).length === 1){
            
            let lastNodes = last.substring(1, last.length - 1).split("=>");

            // return;
            if(applicableNode(lastNodes[1])){
                subPaths.push(["(" + lastNodes[1] + "=>cloned" + ")", unroll]);
            }
        }
    }
    if(subPaths.length !== 1){
        // console.log(subPaths);

        for(let i = 0; i < subPaths.length; i++){
            const subPath = subPaths[i][0];
            const unroll = subPaths[i][1];

            let res = simplifyPathString(subPath);

            
            if(unroll > 1){
                res.path += "^" + unroll;
            }

            if(res.path === ""){
                continue;
            }

            newPath += res.path + "-";
            nodesSet = new Set<string>([...nodesSet, ...res.nodes]);
        }
        newPath = newPath.substring(0, newPath.length - 1);
    }
    else if(subPaths[0][1] > 1){
        let res = simplifyPathString(subPaths[0][0]);
        res.path = "(" + res.path + ")^" + subPaths[0][1];
        newPath = res.path;
        nodesSet = new Set<string>([...res.nodes]);
    }
    else{
        // console.log(path);
        let nodes = path.substring(1, path.length - 1).split("=>");

        if(!applicableNode(nodes[0])){
            nodes = [];
        }
        else{
            nodes = [nodes[0]];
        }
        if(nodes.length === 0){
            newPath = "";
        }
        else{
            newPath = nodes[0];
            nodesSet = new Set<string>([...nodes]);
        }
            
    }
    // console.log(newPath);
    return {path: newPath, nodes: nodesSet};
}

*/

function formatPathString(path : string, nodeMap : any){
    // Map nodes in path to nodeMap values

    let newPath = "";

    let idx = 0;

    while(idx < path.length){
        let res = getNextNode(path.substring(idx));
  
        if(res === null){
            newPath += path.substring(idx);
            break;
        }

        let node = res.node;
        let nodeIdx = idx + res.idx;
        let nodeLen = node.length;

        let newNodeName = "";
        if(node.startsWith("L0")){
            newNodeName = "start";
        }
        else if(node.startsWith("E")){
            newNodeName = "end";
        }
        else if(!isNaN(node)){
            newNodeName = node;
        }
        else{
            newNodeName = nodeMap[node];
        }

        if(newNodeName === undefined){
            newNodeName = "";
            newPath += path.substring(idx, nodeIdx);

            idx = nodeIdx + nodeLen;
            if(newPath[newPath.length - 1] === "-"){
                newPath = newPath.substring(0, newPath.length - 1);
            }
            else if(newPath[newPath.length - 1] === "(" && path[idx] === "-"){
                idx ++;
            }
            continue;
        }

        newPath += path.substring(idx, nodeIdx) + newNodeName;

        idx = nodeIdx + nodeLen;
    }

    return newPath;
}


function isBalanced(s : string){
    let depth = 0;
    
    for(let i = 0; i < s.length; i++){
        if(s[i] === "("){
            depth++;
        }
        else if(s[i] === ")"){
            depth--;
        }
    }

    return depth === 0;
}

export function splitMultiControlPath(path : string){
    // Split the multi control path into multiple paths
    // Returns an array of paths

    // Considering path to be "(....)"
    let lis: any[] = [];

    let len = path.length;
    path = path.substring(1, len - 1);
    len -= 2;
    
    let i = 0;
    let depth = 0;
    let p = "";
    while(i < len){
        if(path[i] === "("){
            depth++;
        }
        else if(path[i] === ")"){
            depth--;
        }
        p += path[i];
        i++;

        if(depth === 0 && (i === len || path[i] === "+")){
            lis.push(p);
            p = "";
            i++;
        }
    }
    if(lis.length === 0){
        lis.push(p);
    }
    return lis;
}

function splitPath(path : string){
    // Split the path into series of multiple paths
    // Returns an array of paths

    // Considering path to be "(....)"
    let lis: any[] = [];

    let len = path.length;
    path = path.substring(1, len - 1);
    len -= 2;

    let i = 0;
    let depth = 0;
    let p = "";

    while(i < len){
        if(path[i] === "("){
            depth++;
        }
        else if(path[i] === ")"){
            depth--;
        }
        p += path[i];
        i++;
    
        if(depth === 0 && (i === len || path[i] === "*" || path[i] === "-")){
            lis.push(p);
            p = "";
            i++;
        }
    }

    return lis;    
}

function notClonedNode(node : string){
    return !node.toLowerCase().includes("cloned") && !node.toLowerCase().includes("clone");
}

function applicableNode(node : string){
    let idx = node.length - 1;
    let num = "";
    while(idx >= 0 && node[idx] !== "%"){
        num = node[idx] + num;
        idx--;
    }
    return notEpsilon(node) &&  notClonedNode(node) && (num === "d" || num === "bbentry");
}

function notEpsilon(path : string){
    return path !== "epsilon";
}

function getNextNode(path : string): any{

    if(path === "" || path === null){
        return null;
    }

    let res = path.match(/[a-z0-9%.]+/i);

    if(res === null){
        return null;
    }

    return {node: res[0], idx: res['index'] };
}

function getNextEdge(path:string): any{
    if(path === "" || path === null){
        return null;
    }

    let res = path.match(/\([a-z0-9%.]+=>[a-z0-9%.]+\)/i);

    if(res === null){
        return null;
    }

    return {edge: res[0], idx: res['index'] };
}

export {parseProofFile, simplifyPathString, seriesCombinationOfPath, pathNode};
