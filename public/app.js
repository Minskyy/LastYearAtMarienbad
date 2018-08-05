document.addEventListener("DOMContentLoaded", event => {

    const app = firebase.app();

})


class Data{

    constructor(){
        this.db = firebase.firestore();
        this.collection = this.db.collection('Games');
    }

    insertGame(player1, player2, winner, moveCount) {
        const game = this.collection.doc();


        this.collection.get().then(function (snap){

            var size = snap.size // will return the collection size
            console.log(size);

            game.set({
                id:size,
                player1: player1,
                player2: player2,
                winner: winner,
                moveCount: moveCount


            }).then(function () {
                console.log("Document successfully written!");
            })
                .catch(function (error) {
                    console.error("Error writing document: ", error);
                });

        });


        

    }



    retrieveGames(){
        var gamesList = document.getElementById("gamesList"); 
        var count =0;
        gamesList.innerText = null
        var array = [];
        this.collection.get().then(function (querySnapshot) {
            querySnapshot.forEach(function (doc) {
                // doc.data() is never undefined for query doc snapshots

                var game = {
                    id: doc.data().id,
                    p1: doc.data().player1,
                    p2: doc.data().player2,
                    winner: doc.data().winner,
                    moves: doc.data().moveCount
                }

                array.push(game);

                
                //console.log(myArray);
                //console.log(doc.id, " => ", doc.data());
                
            });
            array.sort(function (a, b) { return (a.id < b.id) ? 1 : ((b.id < a.id) ? -1 : 0); }); 

            console.log(array);


            for (let index = 0; index < array.length; index++) {
                var option = document.createElement("option");
                option.setAttribute("value", array[index].p1 + " vs " + array[index].p2 + ". Winner: " + array[index].winner + ". move count: " + array[index].moves);
                option.text = array[index].id + ": " + array[index].p1 + " vs " + array[index].p2;
                gamesList.appendChild(option);
            }
            

            var count = querySnapshot.size;
            console.log(count);
            document.getElementById("gameCount").innerHTML = "Games Played: " + count + ", click a game for more info";

            
        });
    }


    
    



}







class NimModel {



    constructor(numHeaps, maxHeapSize, player1, player2, database) {
        this.numHeaps = numHeaps;
        this.maxHeapSize = maxHeapSize;
        this.currentPlayer = 0;
        this.makeHeaps(this.numHeaps, this.maxHeapSize);
        this.isActive = true;
        this.currentPlayers = [];
        this.database=database;

        const p1 = new Player(player1);
        const p2 = new Player(player2);

        this.currentPlayers[0] = p1;
        this.currentPlayers[1] = p2;

        const game = new Game(p1, p2);
        this.currentGame = game;

    }

    makeHeaps(numHeaps, maxHeapSize) {
        this.heaps = new Array();
        for (var i = 0; i < this.numHeaps; ++i) {
            this.heaps.push(new Array());
            var heapSize = 2 * i + 1;
            for (var j = 0; j < heapSize; ++j) {
                this.heaps[i].push(j);
            }
        }
    }

    reset() {
        this.currentPlayer = 0;
        this.makeHeaps(this.numHeaps, this.maxHeapSize);
        this.isActive = true;

        const newGame = new Game(this.currentPlayers[0], this.currentPlayers[1]);

        this.currentGame = newGame;
        
        this.database.retrieveGames();

    }

    move(selection) {
        if (this.isActive && selection) {
            this.heaps[selection.y].splice(selection.x[0], selection.x[1] - selection.x[0]);
            this.isActive = !this.heaps.every(function (heap) {
                return heap.length === 0;
            });
            if (this.isActive) {
                ++this.currentPlayer;
                this.currentPlayer %= 2;
                this.currentGame.moveCount++;
                return { status: 'next_move', state: this.currentPlayer }
            }
        } else if (this.isActive) {
            return { status: 'error', message: 'Error: selection is empty!' };
        }
        if (!this.isActive) {

            var winner = this.currentPlayer == 0 ? 1 : 0;

            this.currentGame.setWinner(this.currentPlayers[winner]);

            this.database.insertGame(this.currentGame.player1.name, this.currentGame.player2.name, this.currentGame.winner.name, this.currentGame.moveCount);


            return { status: 'game_over', state: this.currentPlayer };
        }
    }
}

class NimView {
    constructor(mountNode, width, height) {


        this.mountNode = d3.select(mountNode).append('svg');
        this.width = width;
        this.height = height;

        this.currentSelection = null;
        this.mountNode
            .attr('width', this.width)
            .attr("id", "gameView")
            .attr('height', this.height);

        this.x = d3.scaleBand().padding(0.15).range([0, this.width]);
        this.y = d3.scaleBand().range([0, this.height]);
    }

    initialize(nimModel) {
        var self = this;
        this.nimModel = nimModel;
        this.mountNode.selectAll('*').remove();
        // data-driven domains
        var maxHeapSize = d3.max(this.nimModel.heaps, function (heap) { return d3.max(heap); }) + 1;
        var xDomain = new Array();
        for (var i = 0; i < maxHeapSize; ++i) xDomain.push(i);
        this.x.domain(xDomain);

        var yDomain = new Array();
        for (var i = 0; i < this.nimModel.numHeaps; ++i) yDomain.push(i);
        this.y.domain(yDomain);

        var x = this.x;
        var y = this.y;
        var heaps = this.nimModel.heaps;
        var heapGroups = new Array();
        var heapBrushes = new Array();
        var brushIsActive = false;

        this.mountNode.selectAll('g.heap')
            .data(yDomain).enter()
            .append('g').attr('class', 'heap')
            .attr('width', this.width)
            .attr('height', this.y.bandwidth())
            .attr('transform', function (d) {
                return 'translate(0,' + y(d) + ')';
            })
            .each(function (d, i) {
                heapGroups.push(d3.select(this));
                var heapBrush = d3.brushX()
                    .extent([[0, 0], [self.width, y.bandwidth()]])
                    .on('end', function (d) {
                        if (brushIsActive) return;
                        brushIsActive = true;
                        for (var i = 0; i < heapGroups.length; ++i) {
                            if (i != d) {
                                heapBrushes[i].move(heapGroups[i], null);
                            }
                        }
                        if (d3.event.selection) {
                            var l = -1, r = -1;
                            for (var i = 0; i < heaps[d].length; ++i) {
                                if (l == -1 && x(i) >= d3.event.selection[0]) l = i;
                                if (l != -1 && x(i) + x.bandwidth() <= d3.event.selection[1]) r = i + 1;
                            }
                            // selected range is [l,r)
                            if (l != -1 && r != -1 && l < r) {
                                heapBrushes[d].move(heapGroups[d], [x(l) - x.padding() * x.step(), x(r - 1) + x.bandwidth() + x.padding() * x.step()]);
                                self.currentSelection = { x: [l, r], y: d };
                            } else {
                                heapBrushes[d].move(heapGroups[d], null);
                                self.currentSelection = null;
                            }
                        } else {
                            self.currentSelection = null;
                        }
                        brushIsActive = false;
                    });
                heapBrushes.push(heapBrush);
            });
        this.heapGroups = heapGroups;
        this.heapBrushes = heapBrushes;
    }

    render() {
        var x = this.x;
        var y = this.y;
        var data = new Array();
        for (var i = 0; i < y.domain().length; ++i) {
            var matchSelection = this.heapGroups[i].selectAll('rect.match')
                .data(this.nimModel.heaps[i], function (d) { return d; });
            // match selection exit
            matchSelection.exit().style('opacity', 1)
                .transition().duration(1000)
                .style('opacity', 0)
                .remove();
            // update
            matchSelection
                .transition().duration(1000)
                .attr('x', function (d, idx) { return x(idx); })
            // enter
            matchSelection
                .enter()
                .append('rect')
                .attr('x', function (d, idx) { return x(idx); })
                .attr('y', 5)
                .attr('width', x.bandwidth())
                .attr('height', y.bandwidth() - 10)
                .attr('class', 'match')
                .style('opacity', 0)
                .transition().duration(1000)
                .style('opacity', 1);
            this.heapGroups[i].call(this.heapBrushes[i]);
        }
    }

    clearSelection() {
        for (var i = 0; i < this.y.domain().length; ++i) {
            this.heapBrushes[i].move(this.heapGroups[i], null);
        }
        this.currentSelection = null;
    }
}

class NimController {
    constructor(nimModel, nimView, mountNode, width, height) {

        this.mountNode = d3.select(mountNode).append('div')
            .attr('id', 'nim-controller')
            .style('display', 'inline-block')
            .style('width', width + 'px')
            .style('height', height + 'px');




        var controls = this.mountNode.append('div').style('text-align', 'center');

        controls.append("h1")
        .html("Last Year At Marienbad");

        controls.append("p").html("One by one, the players must remove any amount of objects from one row. The one to make the last move, loses.");

        controls.append("p").html("To play, highlight the objects that you would like to remove, and click move.");

        var status = controls.append("h2")
            .attr("id", "status")
            .html("It's " + (nimModel.currentPlayers[nimModel.currentPlayer].name) + "'s move!");


        controls.append("button").text("Move")
            .attr("type", "button")
            .on('click', function () {
                var moveStatus = nimModel.move(nimView.currentSelection);
                nimView.clearSelection();
                nimView.render();
                if (moveStatus.status === 'error') {
                    status.classed('error', true);
                    status.html(moveStatus.message);
                } else {
                    status.classed('error', false);
                }
                if (moveStatus.status === 'next_move') {
                    status.html("It's " + (nimModel.currentPlayers[nimModel.currentPlayer].name) + "'s move!");
                }
                if (moveStatus.status === 'game_over') {
                    status.classed('success', true);



                    status.html(" " + (nimModel.currentGame.winner.name) + " has won!");


                    this.disabled = true;

                    var moveButton = this;
                    controls.append("button")
                        .attr("class", "button")
                        .attr("type", "button")
                        .text("Play again")
                        .on('click', function () {
                            nimModel.reset();
                            nimView.initialize(nimModel);
                            nimView.render();
                            d3.select(this).remove();
                            document.getElementById("confButton").parentNode.removeChild(document.getElementById("confButton"));

                            moveButton.disabled = false;
                            status.html("It's " + (nimModel.currentPlayers[nimModel.currentPlayer].name) + "'s move!");
                            status.classed("success", false);
                        });


                    controls.append("button")
                        .attr("class", "button")
                        .attr("id","confButton")
                        .attr("type", "button")
                        .text("Change configuration")
                        .on('click', function () {
                            document.getElementById("gameView").parentNode.removeChild(document.getElementById("gameView"));
                            document.getElementById("nim-controller").parentNode.removeChild(document.getElementById("nim-controller"));
                            document.getElementById("frm1").hidden = false;
                            d3.select(this).remove();

                        });
                }
            });

        this.mountNode.append('br')


        this.mountNode.append('h1')
            .text("Stats");


        this.mountNode.append('h2')
            .html("Games Played: 0")
            .attr("id", "gameCount")


        this.mountNode.append('select')
            .attr("id", "gamesList")
            .attr("class", "dropdown")
            .attr("onChange", "check(this);")

        this.mountNode.append('h2')
            .attr("id", "gameInfo")
    }




}



function check(e){
    document.getElementById("gameInfo").innerHTML = e.options[e.selectedIndex].value;
}

class Player {
    constructor(name) {
        this.name = name;
    }
}


class Game {
    constructor(player1, player2) {
        this.player1 = player1;
        this.moveCount = 1;
        this.player2 = player2;
    }

    setWinner(winner) {
        this.winner = winner;
    }

}


function submitSize() {

    tableSize = document.getElementById("textID").value;
    if (/^\+?\d+$/.test(tableSize) && tableSize <= 30 && tableSize >= 2) {
        document.getElementById("frm2").hidden = false;
        document.getElementById("frm1").hidden = true;
    }
    else {
        alert("Insira um número entre 2 e 30");
    }
}


function submitNames() {
    playerName1 = document.getElementById("name1ID").value;
    playerName2 = document.getElementById("name2ID").value;
    document.getElementById("frm2").hidden = true;

    initGame();

}



function initGame() {

    const database = new Data();
    

    var nimView = new NimView(document.getElementById('canvas'), 600, 500);


    var nimModel = new NimModel(tableSize, 30, playerName1, playerName2, database);



    nimView.initialize(nimModel);

    nimView.render();
    var nimController = new NimController(nimModel, nimView,
        document.getElementById('canvas'), 500, 500);


    database.retrieveGames();
};