importScripts('https://unpkg.com/three@0.126.0/build/three.js', "https://unpkg.com/three@0.126.0/examples/js/loaders/GLTFLoader.js")

self.gltfLoader = new THREE.GLTFLoader();
self.gltfLoader.setPath('3D/');

onmessage = function(e)
{
    console.log("Worker received message");
    GenerateTrims(e.data[0],e.data[1],e.data[2]);
}

GenerateTrims = function (ID, StartPosition,direction)
{

    let absDirection = new THREE.Vector3(0,0,0);
    absDirection.copy(direction);
    absDirection.x = Math.abs(absDirection.x);
    absDirection.y = Math.abs(absDirection.y);
    absDirection.z = Math.abs(absDirection.z);
    let IsX = absDirection.x > absDirection.z;

    let positionOffset = new THREE.Vector3(0,0,0);
    let nrToSpawn = 0;
    let length;
    let clipNormal;
    if (IsX)
    {
        if (direction.x > 0)
            clipNormal = new THREE.Vector3(-1,0,0);
        else
            clipNormal = new THREE.Vector3(-1,0,0);
    }
    else
    {
        if (direction.z > 0)
            clipNormal = new THREE.Vector3(0,0,-1);
        else
            clipNormal = new THREE.Vector3(0,0,1);
    }

    //Initial load so we can use data to calculate additional nr of meshes we might need to load after this
    self.gltfLoader.load(ID + ".gltf", function (gltf) {
        let loadedScene = gltf.scene;
        let trimToSpawn;
            loadedScene.traverse((child) => {
                if (child.isMesh) {
                    trimToSpawn = child.parent;
                }
            });

        trimToSpawn.position.copy(StartPosition);
        let box = new THREE.Box3().setFromObject(trimToSpawn);
        let dimensions = new THREE.Vector3(0, 0, 0);
        box.getSize(dimensions);

        if (IsX) {
            nrToSpawn = Math.ceil(absDirection.x / dimensions.x);
            length = absDirection.x;
            if (direction.x < 0) {
                trimToSpawn.rotateY(Math.PI);
                positionOffset.x = -dimensions.x;
            } else {
                positionOffset.x = dimensions.x;
            }

        } else {
            nrToSpawn = Math.ceil(absDirection.z / dimensions.x);
            length = absDirection.z;
            if (direction.z < 0) {
                trimToSpawn.rotateY(Math.PI / 2)
                positionOffset.z = -dimensions.x;
            }
            if (direction.z > 0) {
                trimToSpawn.rotateY(-Math.PI / 2)
                positionOffset.z = dimensions.x;
            }
        }

        //Decrement nr by one seeing as we already spawned one to get the data
        --nrToSpawn;

        if (nrToSpawn <= 0) {
            if (IsX)
            {
                if (direction.x < 0)
                {
                    trimToSpawn.position.x -= length;
                    length = 0;
                }
            }
        } else {
            if (IsX) {
                if (direction.x < 0) {
                    trimToSpawn.position.x -= dimensions.x;
                }
            }

        }

        length -= dimensions.x / 2;

        if (IsX)
            trimToSpawn.position.x += dimensions.x / 2;
        else
            trimToSpawn.position.z += dimensions.x / 2;

        console.log("Sending created trim from worker to core");
        trimToSpawn.updateMatrix();
        let convertedtrim = trimToSpawn.toJSON();

        postMessage([convertedtrim,JSON.stringify(length),JSON.stringify(clipNormal)]);
    })
}