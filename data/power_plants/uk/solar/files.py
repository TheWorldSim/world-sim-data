import os


current_directory = os.path.dirname(os.path.abspath(__file__))
data_directory = os.path.join(current_directory, "../data")


def ouput_intermeditate_file_path(sub):
    return os.path.join(data_directory, sub + "_intermediate_REPD_publication_Q1_2026.csv")

def output_file_path(sub):
    return os.path.join(data_directory, sub + "_processed_REPD_publication_Q1_2026.csv")
