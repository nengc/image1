import lz4.block
compressed_data = open("tmp.lz4", "rb").read()
output_data = lz4.block.decompress(compressed_data)
print(output_data)
