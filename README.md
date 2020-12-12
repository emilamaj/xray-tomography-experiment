## X Ray Tomography Experiment

A simple web interface for experimenting with the algorithms used by x ray CAT scanning machines. (Computer Assisted Tomography)
Basic parameters are available to simulate the penetration of the rays through a 3D model.
These simulated absorption values for the x rays at various positions around a circle are processed to reconstruct "slices" of the model.
Several basic image filtering steps are performed on these 2D slices before they are saved to a "slice pile".
This "slice pile" represents a pile of point grids of the 3D volume that is deduced by the algorithm for the scanned object.
A final step is taken to build the mesh geometry represented by the point grids.

[Image](src)
