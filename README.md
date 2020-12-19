## X Ray Tomography Experiment

A simple web interface for experimenting with the algorithms used by x ray CAT scanning machines. (Computer Assisted Tomography)
Basic parameters are available to simulate the penetration of the rays through a 3D model.
These simulated absorption values for the x rays at various positions around a circle are processed to reconstruct "slices" of the model.
Several basic image filtering steps are performed on these 2D slices before they are saved to a "slice pile".
This "slice pile" represents a pile of point grids of the 3D volume that is deduced by the algorithm for the scanned object.
A final step is taken to build the mesh geometry represented by the point grids.

![Alt text](screenshot.png?raw=true "X ray CAT scan")

To use this code simply load the repository files into your favorite http server and load xray_slicer.html
Efforts to refactor the code are being taken. 
The raycasting routine is currently very laggy. Candidate replacement functions are included in the code.
Feel free to add any modification.
